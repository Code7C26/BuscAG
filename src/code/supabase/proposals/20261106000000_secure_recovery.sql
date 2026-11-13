-- REVIEW ONLY. Apply AFTER 20261105000000_school_features.sql and its baseline.
-- No backfill: historical recovered publications are not bilateral evidence.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
 if to_regclass('buscag_private.recovery_confirmations') is null
 or to_regclass('buscag_private.match_notices') is null then
 raise exception 'Install the reviewed school features baseline first'; end if;
end $$;
alter table buscag_private.recovery_confirmations add column if not exists mode text not null default 'bilateral'
 check(mode in ('bilateral','individual'));

-- Only persisted server-generated matches or actual conversations are links.
-- A client-supplied owner/partner identity is never trusted.
create or replace function buscag_private.recovery_partners(p_item uuid,p_owner uuid)
returns table(id uuid) language sql stable security definer set search_path='' as $$
 select distinct u.id from auth.users u where u.id<>p_owner and (
 exists(select from public.messages m where m.item_id=p_item and
 ((m.sender_id=p_owner and m.recipient_id=u.id) or (m.recipient_id=p_owner and m.sender_id=u.id)))
 or exists(select from buscag_private.match_notices n
 join public.items other on other.id=case when n.lost_id=p_item then n.found_id else n.lost_id end
 where p_item in (n.lost_id,n.found_id) and other.owner_id=u.id))
$$;
revoke all on function buscag_private.recovery_partners(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.recovery_context(p_item uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.items%rowtype; partners jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 select * into i from public.items where id=p_item;
 if not found then raise exception 'Item unavailable' using errcode='42501';end if;
 partners:='[]'::jsonb;
 if i.owner_id=auth.uid() then
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(pr.full_name,'Participante')) order by p.id),'[]'::jsonb)
 into partners from buscag_private.recovery_partners(i.id,i.owner_id) p left join public.profiles pr on pr.id=p.id;
 end if;
 return jsonb_build_object('version',2,'status',i.status,'partners',partners,
 'requests',public.list_recovery_confirmations(p_item));
end $$;
revoke all on function public.recovery_context(uuid) from public,anon,authenticated,service_role;
grant execute on function public.recovery_context(uuid) to authenticated;

-- Evidence, not a caller-controlled GUC/flag, authorizes the status transition.
-- Existing recovered rows are preserved. New INSERTs cannot claim recovery.
create or replace function buscag_private.require_recovery_evidence() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if new.status='recuperado' and (tg_op='INSERT' or old.status is distinct from new.status) then
 if not exists(select from buscag_private.recovery_confirmations r where r.item_id=new.id
 and r.owner_id=new.owner_id and r.state='confirmed' and r.resolved_at is not null) then
 raise exception 'Use the recovery confirmation RPC' using errcode='42501';end if;
 end if;
 return new;
end $$;
revoke all on function buscag_private.require_recovery_evidence() from public,anon,authenticated,service_role;
drop trigger if exists buscag_require_recovery_evidence on public.items;
create trigger buscag_require_recovery_evidence before insert or update of status on public.items
for each row execute function buscag_private.require_recovery_evidence();

create or replace function public.request_item_recovery(p_item uuid,p_partner uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.items%rowtype; r buscag_private.recovery_confirmations%rowtype; new_id uuid;
begin
 select * into i from public.items where id=p_item for no key update;
 if auth.uid() is null or i.owner_id is distinct from auth.uid() then raise exception 'Item owner required' using errcode='42501';end if;
 -- Replays after commit/response loss return the original evidence, no notices.
 select * into r from buscag_private.recovery_confirmations where item_id=p_item and state='confirmed' order by created_at desc limit 1;
 if found then
 if r.owner_id=auth.uid() and r.partner_id is not distinct from p_partner then return r.id;end if;
 raise exception 'Recovery already completed' using errcode='22023';end if;
 if coalesce(i.status not in ('perdido','encontrado'),true) then raise exception 'Active item required' using errcode='22023';end if;
 select * into r from buscag_private.recovery_confirmations where item_id=p_item and state='pending';
 if found then
 if r.partner_id is distinct from p_partner then raise exception 'Resolve pending request first' using errcode='22023';end if;
 return r.id;end if;
 if p_partner is null then
 if exists(select from buscag_private.recovery_partners(i.id,i.owner_id))
 or exists(select from buscag_private.recovery_confirmations where item_id=i.id and mode='bilateral') then
 raise exception 'A linked counterpart must confirm' using errcode='42501';end if;
 else
 if not exists(select from buscag_private.recovery_partners(i.id,i.owner_id) where id=p_partner) then
 raise exception 'Linked counterpart required' using errcode='42501';end if;
 end if;
 if (select count(*) from buscag_private.recovery_confirmations where item_id=p_item and owner_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'recovery_rate_limited' using errcode='P0001';end if;
 insert into buscag_private.recovery_confirmations(item_id,owner_id,partner_id,mode,state,resolved_at)
 values(p_item,auth.uid(),p_partner,case when p_partner is null then 'individual' else 'bilateral' end,
 case when p_partner is null then 'confirmed' else 'pending' end,case when p_partner is null then now() end) returning id into new_id;
 if p_partner is null then
 update public.items set status='recuperado' where id=p_item;
 else
 insert into public.notifications(user_id,title,message,type,related_item_id,related_user_id)
 values(p_partner,'Confirmar devolución','El propietario solicita confirmar la devolución. Revisá el objeto antes de aceptar.','system',p_item,auth.uid());
 end if;
 return new_id;
end $$;

create or replace function public.resolve_item_recovery(p_request uuid,p_accept boolean) returns text
language plpgsql security definer set search_path='' as $$
declare r buscag_private.recovery_confirmations%rowtype; i public.items%rowtype;
begin
 select * into r from buscag_private.recovery_confirmations where id=p_request;
 if not found or auth.uid() is null or (auth.uid() is distinct from r.owner_id and auth.uid() is distinct from r.partner_id) then raise exception 'Participant required' using errcode='42501';end if;
 select * into i from public.items where id=r.item_id for no key update;
 select * into r from buscag_private.recovery_confirmations where id=p_request for update;
 if not found or (auth.uid() is distinct from r.owner_id and auth.uid() is distinct from r.partner_id) then raise exception 'Participant required' using errcode='42501';end if;
 if p_accept is null then raise exception 'Decision required' using errcode='22023';end if;
 if p_accept and auth.uid() is distinct from r.partner_id then raise exception 'Other participant must confirm' using errcode='42501';end if;
 if r.state<>'pending' then return r.state;end if;
 if p_accept then
 if r.owner_id is null or r.partner_id is null then raise exception 'Participant account deleted; cancel the request' using errcode='22023';end if;
 if i.owner_id is distinct from r.owner_id or coalesce(i.status not in ('perdido','encontrado'),true) then raise exception 'Item changed; cancel the request' using errcode='22023';end if;
 end if;
 -- Store evidence before updating the item, in the SAME transaction.
 update buscag_private.recovery_confirmations set state=case when p_accept then 'confirmed' else 'cancelled' end,resolved_at=now()
 where id=p_request returning * into r;
 if p_accept then update public.items set status='recuperado' where id=r.item_id;end if;
 if (case when auth.uid()=r.owner_id then r.partner_id else r.owner_id end) is not null then
 insert into public.notifications(user_id,title,message,type,related_item_id,related_user_id)
 values(case when auth.uid()=r.owner_id then r.partner_id else r.owner_id end,'Confirmación de devolución',
 case when p_accept then 'Ambas partes confirmaron la devolución.' else 'Confirmación rechazada o solicitud cancelada.' end,'system',r.item_id,auth.uid());
 end if;
 return r.state;
end $$;
revoke all on function public.request_item_recovery(uuid,uuid),public.resolve_item_recovery(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.request_item_recovery(uuid,uuid),public.resolve_item_recovery(uuid,boolean) to authenticated;
commit;

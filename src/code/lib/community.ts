import { supabase } from './supabase';
export type CommunityMethod = 'my_community_settings'|'save_my_profile'|'set_user_block'|'list_my_blocks'|'can_share_contact'|'submit_report'|'list_reports'|'moderate_report'|'report_audit'|'set_item_follow'|'my_item_follow'|'rate_recovery'|'received_ratings';
export async function communityCall(name: CommunityMethod, args: any = {}): Promise<any> {
  if (!supabase) throw Error('Servicio no disponible.');
  const {data,error} = await supabase.rpc(name,args);
  if(error || data===null) throw Error('No se pudo confirmar la operación. Verificá la conexión y la disponibilidad del servicio.');
  return data;
}
export function normalizePhone(value:string) {return value.replace(/[ ()-]/g,'');}
export function validPhone(value:string) {return value===''||/^\+[1-9][0-9]{7,14}$/.test(value);}
export const REPORT_REASONS = {estafa:'Estafa',spam:'Spam',falsa:'Publicación falsa',inapropiado:'Contenido inapropiado',acoso:'Acoso',otro:'Otro'};

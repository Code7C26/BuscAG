import {communityCall,ServiceUnavailableError} from '../../lib/community';
import {supabase} from '../../lib/supabase';
import {loadDraft,saveDraft,type QueuedMessage} from '../../lib/chatStorage';
import {SafetyActions} from './SafetyActions';
import {RecoveryPanel} from './RecoveryPanel';
import { useDialogFocus } from '../utils/useDialogFocus';
/**
 * MODAL DE CONTACTO Y CHAT DIRECTO (ContactModal.tsx)
 * Permite a los usuarios comunicarse directamente con quien publicó un objeto.
 * Incluye:
 * - Historial en tiempo real de mensajes enviados y recibidos asociados a la publicación
 * - Respuestas y preguntas predeterminadas ("Respuestas rápidas") para agilizar el contacto
 * - Botón de llamada telefónica directa (si el publicador compartió su número)
 * - Indicadores visuales de confirmación de envío (doble tilde azul)
 */
import React, { useEffect, useState, useRef } from 'react';
import { X, Send, Phone, MessageSquare, Check, CheckCheck, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { Item, Message, User } from '../types';

// Propiedades que recibe el componente ContactModal
interface ContactModalProps {
  item: Item | null;                                    // Objeto sobre el cual se conversa
  isOpen: boolean;                                      // Si el modal está visible o no
  onClose: () => void;                                  // Cierra la ventana de chat
  currentUser: User;                                    // Usuario actual que envía los mensajes
  messages: Message[];
  outbox?:QueuedMessage[];
  onRetryMessage?:(message:QueuedMessage)=>void;
  onDiscardMessage?:(message:QueuedMessage)=>void;                                  // Todos los mensajes almacenados
  participantId: string | null;
  onMarkThreadRead: (itemId: string, senderId: string) => void;
  onRecoveryChanged?: () => void;
  onSendMessage: (itemId: string, text: string, recipientId: string) => Promise<void>;
}

// Opciones de mensajes rápidos para iniciar conversación en un solo clic
const PRESET_PROMPTS = [
  '¿Aún conservas el objeto?',
  'Hola, creo que el objeto es mío. Te enviaré una prueba.',
  '¿Dónde podemos encontrarnos para la entrega?',
  '¡Hola! Tengo información sobre este reporte.'
];

export const ContactModal: React.FC<ContactModalProps> = ({
  item,
  isOpen,
  onClose,
  currentUser,
  messages,
  outbox=[],
  onRetryMessage,
  onDiscardMessage,
  participantId,
  onMarkThreadRead,
  onSendMessage,
  onRecoveryChanged = ()=>{}
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen, dialogRef, onClose);

  const thread=JSON.stringify([item?.id,participantId]);
  const failedDraft=useRef<string|null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [draftNotice,setDraftNotice]=useState('');
  const [sharedPhone,setSharedPhone]=useState('');
  useEffect(()=>{let active=true,unavailable=false;setSharedPhone('');if(!isOpen||!participantId||!supabase)return()=>{active=false;};
    const refresh=async()=>{if(!active||unavailable||!isOpen||!participantId||!supabase)return;try{const allowed=await communityCall('can_share_contact',{p_target:participantId});if(!active)return;if(allowed!==true){setSharedPhone('');return;}const r=await supabase.from('public_profiles').select('phone').eq('id',participantId).maybeSingle();if(active)setSharedPhone(r.error?'':r.data?.phone??'');}catch(error){if(error instanceof ServiceUnavailableError)unavailable=true;if(active)setSharedPhone('');}};
    void refresh();const timer=setInterval(refresh,5000);return()=>{active=false;clearInterval(timer);};
  },[isOpen,participantId,currentUser.id]);
  const [isSending, setIsSending] = useState(false);
  const sendLock = useRef(false);
  const threadVersion = useRef(0);
  useEffect(() => {
    threadVersion.current += 1;
    sendLock.current = false;
    setIsSending(false);
    setInputMessage(loadDraft(currentUser.id,thread));
    failedDraft.current=null;
    return () => { threadVersion.current += 1; };
  }, [item?.id, participantId, isOpen, currentUser.id]);

  const unreadKey = messages.filter(message => message.itemId === item?.id
    && message.senderId === participantId && message.receiverId === currentUser.id && !message.isRead)
    .map(message => message.id).join(',');
  useEffect(() => {
    const mark=()=>{if(document.visibilityState!=='hidden'&&isOpen&&item&&participantId&&unreadKey)onMarkThreadRead(item.id,participantId);};
    mark();document.addEventListener('visibilitychange',mark);return()=>document.removeEventListener('visibilitychange',mark);
  }, [item?.id, participantId, currentUser.id, isOpen, unreadKey, onMarkThreadRead]);

  useEffect(()=>{
    const text=failedDraft.current;
    if(!text||!item||!participantId||outbox.some(row=>row.itemId===item.id&&row.recipientId===participantId&&row.text===text.trim()))return;
    if(messages.some(row=>row.itemId===item.id&&row.senderId===currentUser.id&&row.receiverId===participantId&&row.text===text.trim())) {
      setInputMessage(previous=>{if(previous===text){saveDraft(currentUser.id,thread,'');return '';}return previous;});failedDraft.current=null;
    }
  },[messages,outbox,item?.id,participantId,currentUser.id]);

  // Si no está abierto o no hay objeto, no renderiza nada
  if (!isOpen || !item) return null;

  const participantMessage = participantId
    ? messages.find(message => message.itemId === item.id && message.senderId === participantId)
    : undefined;
  const participantName = item.user.id === currentUser.id
    ? participantMessage?.senderName ?? 'Usuario'
    : item.user.name;
  const participantAvatar = item.user.id === currentUser.id
    ? participantMessage?.senderAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(participantName)}`
    : item.user.avatar;
  const itemMessages = messages.filter(message =>
    message.itemId === item.id &&
    participantId !== null &&
    ((message.senderId === currentUser.id && message.receiverId === participantId) ||
      (message.receiverId === currentUser.id && message.senderId === participantId))
  );

  /**
   * Manejador del envío de mensaje escrito manualmente
   */
  const send = async (text: string, clearDraft: boolean) => {
    if (!text.trim() || !participantId || sendLock.current) return;
    sendLock.current = true; // Synchronous: also covers two events before a render.
    setIsSending(true);
    const version = threadVersion.current;
    try {
      await onSendMessage(item.id, text.trim(), participantId);
      if (version === threadVersion.current && clearDraft) {
        setInputMessage(previous => {if(previous===text){saveDraft(currentUser.id,thread,'');return '';}return previous;});
      }
    } catch {
      if(version===threadVersion.current)failedDraft.current=text;
      // The outbox retains this attempt with the same idempotency key.
    } finally {
      if (version === threadVersion.current) {
        sendLock.current = false;
        setIsSending(false);
      }
    }
  };
  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    void send(inputMessage, true);
  };
  const handlePresetClick = (presetText: string) => { void send(presetText, false); };

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Conversación" tabIndex={-1} className="modal-dialog w-full max-w-lg overflow-hidden flex flex-col h-[85vh] max-h-[650px] animate-in zoom-in-95 duration-200">
        {/* Cabecera del Chat con datos del publicador */}
        <div className="modal-header p-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={participantAvatar}
              alt={participantName}
              className="w-10 h-10 rounded-full object-cover border border-slate-200"
            />
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 truncate">
                {participantName}
                {item.user.id !== currentUser.id && item.user.verified && <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" aria-label="Verificado" />}
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Publicación: <span className="font-semibold text-slate-700">{item.title||'Publicación sin título'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Opción de llamada telefónica directa */}
            {sharedPhone && (
              <a
                href={`tel:${sharedPhone}`}
                className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                title="Llamar directamente"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition cursor-pointer"
              title="Cerrar chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra resumen del objeto en conversación */}
        <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
            <span className="text-xs font-semibold text-slate-800 truncate">{item.title||'Publicación sin título'}</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            item.status === 'perdido' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {item.status === 'recuperado' ? 'Objeto recuperado' : item.status === 'perdido' ? 'Perdido' : 'Encontrado'}
          </span>
        </div>

        {/* Flujo de Mensajes (Burbujas tipo WhatsApp / Mensajería moderna) */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
          <details className="chat-context-tools"><summary>Devolución y seguridad</summary>
            <RecoveryPanel key={item.id+currentUser.id} item={item} userId={currentUser.id} onChanged={onRecoveryChanged}/>
            {participantId&&<SafetyActions key={participantId+currentUser.id} userId={currentUser.id} targetUserId={participantId}/>}
          </details>
          {itemMessages.length === 0 ? (
            /* Estado vacío si no hay mensajes previos */
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <MessageSquare className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Comienza la conversación</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Envía un mensaje para ponerte en contacto con {item.user.name} sobre este objeto.
              </p>
            </div>
          ) : (
            /* Listado de mensajes enviados y recibidos */
            itemMessages.map((msg) => {
              const isMe = msg.senderId === currentUser.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl text-xs sm:text-sm font-medium shadow-xs ${
                      isMe
                        ? 'bg-slate-800 text-white rounded-br-none'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 px-1">
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && <>{msg.isRead?<CheckCheck aria-hidden="true" className="w-3 h-3 text-blue-500"/>:<Check aria-hidden="true" className="w-3 h-3 text-slate-400"/>}<span>{msg.isRead?'Leído':'Enviado'}</span></>}
                  </div>
                </div>
              );
            })
          )}
          {outbox.filter(row=>row.itemId===item.id&&row.recipientId===participantId).map(row => (
            <div key={row.key} className="chat-pending-card border border-amber-300 rounded-xl p-3 text-sm">
              <p>{row.text}</p>
              <p role="status">{row.status==='pending'?'Pendiente de confirmación del servidor':row.retryable?'Fallido. Se reintentará al recuperar conexión.':'Fallido. Revisá la disponibilidad o las restricciones del servicio antes de reintentar.'}</p>
              {row.status==='failed' && (
                <div className="chat-pending-actions">
                  <button onClick={()=>onRetryMessage?.(row)}>Reintentar mensaje</button>
                  <button onClick={()=>onDiscardMessage?.(row)}>Descartar pendiente</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="px-4 text-xs text-slate-500">Borradores privados en esta pestaña: caducan tras 24 h sin cambios. Cerrar sesión borra borradores y pendientes.</p>
        {draftNotice&&<p role="status" className="text-xs px-4">{draftNotice}</p>}
        {/* Respuestas rápidas prediseñadas en carrusel horizontal */}
        <div className="px-3 py-2 bg-white border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Respuestas rápidas:
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {PRESET_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handlePresetClick(prompt)}
                disabled={isSending}
                className="px-2.5 py-1 rounded-full text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-medium whitespace-nowrap transition border border-slate-200/80 cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Campo inferior de redacción y envío */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
          <input
            type="text"
            value={inputMessage}
            maxLength={4000}
            onChange={(e) => {const value=e.target.value.slice(0,4000);setInputMessage(value);if(!saveDraft(currentUser.id,thread,value))setDraftNotice('El borrador sólo está en memoria: el almacenamiento de esta pestaña no está disponible.');}}
            placeholder="Escribe un mensaje..."
            className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 outline-none font-medium"
          />

          <button
            type="submit"
            disabled={isSending || !inputMessage.trim()}
            className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition cursor-pointer shrink-0 shadow-md shadow-blue-600/20"
            title="Enviar mensaje"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};

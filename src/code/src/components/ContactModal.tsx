/**
 * MODAL DE CONTACTO Y CHAT DIRECTO (ContactModal.tsx)
 * Permite a los usuarios comunicarse directamente con quien publicó un objeto.
 * Incluye:
 * - Historial en tiempo real de mensajes enviados y recibidos asociados a la publicación
 * - Respuestas y preguntas predeterminadas ("Respuestas rápidas") para agilizar el contacto
 * - Botón de llamada telefónica directa (si el publicador compartió su número)
 * - Indicadores visuales de confirmación de envío (doble tilde azul)
 */
import React, { useEffect, useState } from 'react';
import { X, Send, Phone, MessageSquare, Check, CheckCheck, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { Item, Message, User } from '../types';

// Propiedades que recibe el componente ContactModal
interface ContactModalProps {
  item: Item | null;                                    // Objeto sobre el cual se conversa
  isOpen: boolean;                                      // Si el modal está visible o no
  onClose: () => void;                                  // Cierra la ventana de chat
  currentUser: User;                                    // Usuario actual que envía los mensajes
  messages: Message[];                                  // Todos los mensajes almacenados
  participantId: string | null;
  onMarkThreadRead: (itemId: string, senderId: string) => void;
  onSendMessage: (itemId: string, text: string, recipientId: string) => void;
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
  participantId,
  onMarkThreadRead,
  onSendMessage
}) => {
  const [inputMessage, setInputMessage] = useState('');
  useEffect(() => {
    setInputMessage('');
    if (isOpen && item && participantId) onMarkThreadRead(item.id, participantId);
  }, [item?.id, participantId, isOpen, onMarkThreadRead]);

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
  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim()) return;
    if (!participantId) return;

    // Emite el mensaje al componente principal App.tsx
    onSendMessage(item.id, inputMessage.trim(), participantId);
    setInputMessage('');
  };

  /**
   * Manejador para enviar una respuesta predeterminada directamente con un toque
   */
  const handlePresetClick = (presetText: string) => {
    if (participantId) onSendMessage(item.id, presetText, participantId);
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="modal-dialog w-full max-w-lg overflow-hidden flex flex-col h-[85vh] max-h-[650px] animate-in zoom-in-95 duration-200">
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
                Publicación: <span className="font-semibold text-slate-700">{item.title}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Opción de llamada telefónica directa */}
            {participantId === item.user.id && item.user.phone && (
              <a
                href={`tel:${item.user.phone}`}
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
            <span className="text-xs font-semibold text-slate-800 truncate">{item.title}</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            item.status === 'perdido' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {item.status === 'perdido' ? 'Perdido' : 'Encontrado'}
          </span>
        </div>

        {/* Flujo de Mensajes (Burbujas tipo WhatsApp / Mensajería moderna) */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
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
                    {isMe && <CheckCheck className={`w-3 h-3 ${msg.isRead ? 'text-blue-500' : 'text-slate-400'}`} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

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
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 outline-none font-medium"
          />

          <button
            type="submit"
            disabled={!inputMessage.trim()}
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

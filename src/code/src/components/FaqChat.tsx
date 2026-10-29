import { useState, type FormEvent } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

const suggestedQuestions = [
  '¿Cómo publico un objeto que encontré?',
  '¿Qué hago si perdí algo?',
  '¿Cómo contacto al publicador?'
];

const faqEntries = [
  {
    keywords: ['publicacion falsa', 'publicacion sospechosa', 'reporte falso', 'reportar usuario', 'reportar publicacion'],
    answer: 'En la versión actual todavía no hay un botón para reportar publicaciones. Evita compartir datos personales o coordinar un encuentro si algo te parece sospechoso. El equipo debe definir un canal oficial de contacto para recibir estos reportes.'
  },
  {
    keywords: ['cuanto cuesta', 'cuesta usar', 'costo', 'precio', 'gratuito', 'gratis'],
    answer: 'Usar BuscAG es gratuito para la comunidad de Alta Gracia.'
  },
  {
    keywords: ['sin foto', 'subir foto', 'foto', 'fotografia', 'imagen'],
    answer: 'El formulario muestra una foto de ejemplo preseleccionada y actualmente no ofrece una opción visible para quitarla. Cámbiala por una foto clara del objeto; puedes subir una imagen JPG, PNG o WebP de hasta 5 MB.'
  },
  {
    keywords: ['encontre un objeto', 'objeto que encontre', 'hallado', 'halle un objeto', 'publique encontrado', 'publicar encontrado'],
    answer: 'Inicia sesión, pulsa el botón + «Publicar» y selecciona «Lo encontré (Encontrado)». Completa el nombre y la descripción, elige categoría y fecha, indica dónde lo hallaste y reemplaza la foto de muestra por una imagen clara. Luego pulsa «Publicar Objeto».'
  },
  {
    keywords: ['perdi un objeto', 'perdi algo', 'objeto que perdi', 'objeto perdido', 'perder un objeto', 'se me perdio'],
    answer: 'Inicia sesión, pulsa el botón + «Publicar» y selecciona «Lo perdí (Perdido)». Indica el nombre y los detalles del objeto, categoría, fecha y último lugar donde lo viste. Puedes agregar una recompensa opcional y publicar el reporte.'
  },
  {
    keywords: ['lugar seguro', 'encuentro seguro', 'entregar objeto', 'retirar objeto', 'devolver objeto'],
    answer: 'Coordina la entrega o el retiro en un lugar público y concurrido de Alta Gracia, como una plaza, una comisaría o una zona céntrica, y preferentemente durante el día. No compartas tu domicilio.'
  },
  {
    keywords: ['ya recupere', 'recupere mi objeto', 'devolvi', 'marcar resuelto', 'eliminar publicacion', 'borrar publicacion'],
    answer: 'Abre tu perfil y busca la publicación. Puedes marcarla como «Marcar Recuperado» o eliminarla con el botón de papelera para mantener actualizada la lista.'
  },
  {
    keywords: ['sin cuenta', 'necesito cuenta', 'cuenta para usar', 'crear cuenta', 'registrarme', 'iniciar sesion', 'navegar sin registrarme'],
    answer: 'Actualmente BuscAG requiere iniciar sesión para entrar a la aplicación. Necesitas una cuenta para publicar y contactar a otros usuarios.'
  },
  {
    keywords: ['datos personales', 'datos protegidos', 'privacidad', 'seguridad de mis datos'],
    answer: 'El perfil puede mostrar tu nombre, ubicación, avatar y calificación; el teléfono puede aparecer como opción de llamada si lo configuraste. Comparte solo la información necesaria y no publiques contraseñas, domicilio exacto ni otros datos sensibles.'
  },
  {
    keywords: ['contactar', 'contacto', 'mensaje directo', 'hablar con', 'telefono del usuario', 'llamar al publicador'],
    answer: 'Abre el detalle del objeto y pulsa «Contactar al Publicador» para enviarle un mensaje. Si la persona configuró un teléfono, también puede aparecer la opción para llamarla.'
  },
  {
    keywords: ['buscar', 'busco', 'filtro', 'categoria', 'categoría'],
    answer: 'En Inicio puedes buscar por nombre, descripción o lugar. También puedes filtrar por objetos perdidos, encontrados y categoría. «Cerca de mí» requiere permiso de ubicación del navegador.'
  },
  {
    keywords: ['coincidencia', 'match', 'parecido', 'encontre algo parecido'],
    answer: 'BuscAG compara automáticamente los reportes perdidos y encontrados de una misma categoría. Revisa la pestaña «Matches» o las coincidencias del detalle y contacta al publicador si reconoces el objeto.'
  },
  {
    keywords: ['correo', 'email', 'contraseña', 'contrasena', 'confirmar cuenta'],
    answer: 'Puedes crear una cuenta desde la pantalla de acceso. Si recibes un correo de confirmación, ábrelo antes de iniciar sesión. La contraseña debe tener al menos 6 caracteres.'
  },
  {
    keywords: ['ubicacion', 'ubicación', 'gps', 'cerca de mi', 'cerca de mí'],
    answer: 'La búsqueda cercana necesita permiso de ubicación del navegador. Si no quieres compartirla, puedes seguir buscando por texto y filtros; la ubicación no es necesaria para esas búsquedas.'
  },
  {
    keywords: ['publicar un objeto', 'como publico', 'cómo publico', 'publicar algo'],
    answer: 'Inicia sesión y pulsa el botón + «Publicar» en la navegación. Selecciona si encontraste o perdiste el objeto, completa los datos solicitados y pulsa «Publicar Objeto».'
  }
];

function getFaqAnswer(question: string) {
  const normalizedQuestion = question
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const matchingEntry = faqEntries.find(entry =>
    entry.keywords.some(keyword => normalizedQuestion.includes(
      keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    ))
  );

  return matchingEntry?.answer ?? 'No encontré una respuesta para eso en las preguntas frecuentes. Prueba con «publicar», «buscar», «contactar», «foto», «seguridad» o «gratis».';
}

export function FaqChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: '¡Hola! Puedo ayudarte con preguntas frecuentes sobre objetos perdidos y encontrados.' }
  ]);

  const askQuestion = (text: string) => {
    const trimmedQuestion = text.trim();
    if (!trimmedQuestion) return;
    setMessages(previous => [
      ...previous,
      { role: 'user', text: trimmedQuestion },
      { role: 'assistant', text: getFaqAnswer(trimmedQuestion) }
    ]);
    setQuestion('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    askQuestion(question);
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 sm:bottom-6 sm:right-6">
      {isOpen && (
        <section
          aria-label="Chat de preguntas frecuentes"
          className="mb-3 flex max-h-[min(70dvh,34rem)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold">Ayuda rápida</h2>
                <p className="text-xs text-slate-300">Preguntas frecuentes</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar chat"
              className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.map((message, index) => (
              <p
                key={`${index}-${message.role}`}
                className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'ml-auto rounded-br-sm bg-blue-600 text-white'
                    : 'rounded-bl-sm bg-slate-100 text-slate-800'
                }`}
              >
                {message.text}
              </p>
            ))}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestedQuestions.map(suggestion => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => askQuestion(suggestion)}
                    className="rounded-full border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-200 p-3">
            <label className="sr-only" htmlFor="faq-chat-question">Escribe tu pregunta</label>
            <input
              id="faq-chat-question"
              value={question}
              onChange={event => setQuestion(event.target.value)}
              placeholder="Escribe tu pregunta..."
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              disabled={!question.trim()}
              aria-label="Enviar pregunta"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        aria-label={isOpen ? 'Cerrar ayuda' : 'Abrir ayuda de preguntas frecuentes'}
        aria-expanded={isOpen}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-900/20 transition hover:scale-105 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        {isOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <MessageCircle className="h-6 w-6" aria-hidden="true" />}
      </button>
    </div>
  );
}
import React, { useState } from 'react';
import { Compass, LoaderCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const AuthView: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setErrorMessage('Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        const redirectBase = import.meta.env.VITE_APP_URL?.trim() || window.location.origin;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: new URL('/', redirectBase).toString(),
            data: {
              full_name: name.trim(),
              phone: phone.trim(),
              location: location.trim()
            }
          }
        });
        if (error) throw error;
        if (!data.session) {
          setSuccessMessage('Te enviamos un correo para confirmar tu cuenta. Luego podrás iniciar sesión.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      console.error('No se pudo completar la autenticación:', error);
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo completar la autenticación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-7 sm:p-9">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20 mb-4">
            <Compass className="w-8 h-8" />
          </div>
          <h1 className="font-extrabold text-2xl text-slate-900">
            Objetos<span className="text-blue-600">Perdidos</span>
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {mode === 'signin' ? 'Inicia sesión para continuar' : 'Crea tu cuenta comunitaria'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <label className="block text-sm font-semibold text-slate-700">
                Nombre completo
                <input
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-normal outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Teléfono de contacto (visible al contactar tus publicaciones)
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-normal outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Barrio o localidad
                <input
                  autoComplete="address-level2"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-normal outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </>
          )}
          <label className="block text-sm font-semibold text-slate-700">
            Correo electrónico
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-normal outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Contraseña
            <input
              required
              type="password"
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-normal outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          {errorMessage && (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting && <LoaderCircle className="w-4 h-4 animate-spin" />}
            {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          {mode === 'signin' ? '¿Todavía no tienes cuenta?' : '¿Ya tienes una cuenta?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className="font-bold text-blue-600 hover:text-blue-700"
          >
            {mode === 'signin' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </section>
    </main>
  );
};

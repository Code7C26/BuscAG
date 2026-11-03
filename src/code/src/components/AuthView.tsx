import React, { useState, useRef, useEffect } from 'react';
import { Compass, LoaderCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { authRedirect, authErrorMessage } from '../../lib/authFlow';
import { FaqChat } from './FaqChat';

type AuthMode = 'signin' | 'signup' | 'reset' | 'update' | 'resend';
export const AuthView: React.FC<{ recovery?: boolean; onRecovered?: () => void; notice?: string }> = ({ recovery = false, onRecovered, notice = '' }) => {
  const [mode, setMode] = useState<AuthMode>(recovery ? 'update' : 'signin');
  const lifetime = useRef(0);
  const busy = useRef(false);
  useEffect(() => () => { lifetime.current += 1; }, []);
  useEffect(() => { if (recovery) setMode('update'); }, [recovery]);
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
    if (busy.current) return;
    if (!supabase) {
      setErrorMessage('Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.');
      return;
    }

    if ((mode === 'signup' || mode === 'update') && password.length < 8) {
      setErrorMessage('La nueva contraseña debe tener al menos 8 caracteres.'); return;
    }
    if (mode === 'signup' && !name.trim()) { setErrorMessage('Completa tu nombre.'); return; }
    const version = lifetime.current;
    busy.current = true;
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const redirectBase = import.meta.env?.VITE_APP_URL?.trim() || window.location.origin;
      const redirect = authRedirect(redirectBase);
      if (mode === 'reset' || mode === 'resend') {
        const { error } = mode === 'reset'
          ? await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect(redirectBase, true) })
          : await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirect } });
        if (error) throw error;
        if (version === lifetime.current) setSuccessMessage('Si la cuenta admite esta operación, recibirás un correo con los siguientes pasos.');
      } else if (mode === 'update') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        if (version === lifetime.current) { setPassword(''); onRecovered?.(); }
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirect,
            data: {
              full_name: name.trim(),
              phone: phone.trim(),
              location: location.trim()
            }
          }
        });
        if (error) throw error;
        if (version === lifetime.current && !data.session) {
          setSuccessMessage('Te enviamos un correo para confirmar tu cuenta. Luego podrás iniciar sesión.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (error) {
      if (version === lifetime.current) setErrorMessage(authErrorMessage(error));
    } finally {
      busy.current = false;
      if (version === lifetime.current) setIsSubmitting(false);
    }
  };

  const changeMode = (next: AuthMode) => {
    if (busy.current) return;
    lifetime.current += 1; setMode(next); setPassword(''); setErrorMessage(''); setSuccessMessage('');
  };
  const label = mode === 'signin' ? 'Iniciar sesión' : mode === 'signup' ? 'Crear cuenta'
    : mode === 'update' ? 'Guardar nueva contraseña' : mode === 'reset' ? 'Recuperar contraseña' : 'Reenviar confirmación';

  return (
    <main className="auth-view min-h-screen flex items-center justify-center px-4 py-10">
      <section className="auth-card w-full max-w-md border p-7 sm:p-9">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="auth-brand-mark w-14 h-14 rounded-2xl text-white flex items-center justify-center mb-4">
            <Compass className="w-7 h-7" />
          </div>
          <h1 className="font-semibold text-2xl text-slate-900">
            Objetos <span className="text-blue-800">Perdidos</span>
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {mode === 'signin' ? 'Inicia sesión para continuar' : mode === 'signup' ? 'Crea tu cuenta comunitaria' : label}
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
                  className="auth-input mt-1.5 w-full border px-3.5 py-2.5 font-normal outline-none"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Teléfono de contacto (visible al contactar tus publicaciones)
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="auth-input mt-1.5 w-full border px-3.5 py-2.5 font-normal outline-none"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Barrio o localidad
                <input
                  autoComplete="address-level2"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="auth-input mt-1.5 w-full border px-3.5 py-2.5 font-normal outline-none"
                />
              </label>
            </>
          )}
          {mode !== 'update' && <label className="block text-sm font-semibold text-slate-700">
            Correo electrónico
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="auth-input mt-1.5 w-full border px-3.5 py-2.5 font-normal outline-none"
            />
          </label>}
          {(mode === 'signin' || mode === 'signup' || mode === 'update') && <label className="block text-sm font-semibold text-slate-700">
            {mode === 'update' ? 'Nueva contraseña' : 'Contraseña'}
            <input
              required
              type="password"
              minLength={mode === 'signin' ? 6 : 8}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="auth-input mt-1.5 w-full border px-3.5 py-2.5 font-normal outline-none"
            />
          </label>}

          {(errorMessage || notice) && (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{errorMessage || notice}</p>
          )}
          {successMessage && (
            <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting && <LoaderCircle className="w-4 h-4 animate-spin" />}
            {label}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          {mode === 'signin' ? '¿Todavía no tienes cuenta?' : mode === 'signup' ? '¿Ya tienes una cuenta?' : ''}{' '}
          <button type="button" disabled={isSubmitting}
            onClick={() => mode === 'update' ? onRecovered?.() : changeMode(mode === 'signin' ? 'signup' : 'signin')}
            className="font-bold text-blue-600 hover:text-blue-700">
            {mode === 'signin' ? 'Regístrate' : mode === 'update' ? 'Volver a la aplicación' : 'Inicia sesión'}
          </button>
        </p>
        {(mode === 'signin' || mode === 'signup') && <p className="text-center text-sm text-slate-500 mt-6">
          <button type="button" disabled={isSubmitting} onClick={() => changeMode('reset')}
            className="font-bold text-blue-600 hover:text-blue-700">Recuperar contraseña</button>{' · '}
          <button type="button" disabled={isSubmitting} onClick={() => changeMode('resend')}
            className="font-bold text-blue-600 hover:text-blue-700">Reenviar confirmación</button>
        </p>}
      </section>
      <FaqChat />
    </main>
  );
};

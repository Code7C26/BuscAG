import {LanguageSelector} from '../i18n';
import {t, useLanguage} from "../i18n";
import React, { useState, useRef, useEffect } from "react";
import { Compass, LoaderCircle, ArrowUpRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  authRedirectForApp,
  authErrorMessage,
  authMailMessage,
  AUTH_MAIL_COOLDOWN_MS,
} from "../../lib/authFlow";
import { FaqChat } from "./FaqChat";

type AuthMode = "signin" | "signup" | "reset" | "update" | "resend";
export const AuthView: React.FC<{
  recovery?: boolean;
  onRecovered?: () => void;
  notice?: string;
}> = ({ recovery = false, onRecovered, notice = "" }) => {
  useLanguage();
  const mailDeadlines = useRef(new Map<string, number>());
  const [clock, setClock] = useState(Date.now());
  const ticking = [...mailDeadlines.current.values()].some(
    (deadline) => deadline > clock,
  );
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);
  const [mode, setMode] = useState<AuthMode>(recovery ? "update" : "signin");
  const lifetime = useRef(0);
  const busy = useRef(false);
  useEffect(
    () => () => {
      lifetime.current += 1;
    },
    [],
  );
  useEffect(() => {
    if (recovery) setMode("update");
  }, [recovery]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current) return;
    if (!supabase) {
      setErrorMessage(
        t("Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY."),
      );
      return;
    }

    if ((mode === "signup" || mode === "update") && password.length < 8) {
      setErrorMessage(t("La nueva contraseña debe tener al menos 8 caracteres."));
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setErrorMessage(t("Completa tu nombre."));
      return;
    }
    const mailKey = mode + ":" + email.trim().toLowerCase();
    if (
      ["signup", "reset", "resend"].includes(mode) &&
      (mailDeadlines.current.get(mailKey) ?? 0) > Date.now()
    )
      return;
    const version = lifetime.current;
    busy.current = true;
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const redirectBase = import.meta.env?.VITE_APP_URL?.trim();
      const redirect = ["signup", "reset", "resend"].includes(mode)
        ? authRedirectForApp(redirectBase, window.location.href)
        : "";
      if (mode === "reset" || mode === "resend") {
        const { error } =
          mode === "reset"
            ? await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: authRedirectForApp(
                  redirectBase,
                  window.location.origin,
                  true,
                ),
              })
            : await supabase.auth.resend({
                type: "signup",
                email: email.trim(),
                options: { emailRedirectTo: redirect },
              });
        if (error) throw error;
        mailDeadlines.current.set(mailKey, Date.now() + AUTH_MAIL_COOLDOWN_MS);
        setClock(Date.now());
        if (version === lifetime.current)
          setSuccessMessage(authMailMessage(mode));
      } else if (mode === "update") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        if (version === lifetime.current) {
          setPassword("");
          onRecovered?.();
        }
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirect,
            data: {
              full_name: name.trim(),
              phone: phone.trim(),
              location: location.trim(),
            },
          },
        });
        if (error) throw error;
        if (version === lifetime.current && !data.session) {
          mailDeadlines.current.set(
            mailKey,
            Date.now() + AUTH_MAIL_COOLDOWN_MS,
          );
          setClock(Date.now());
          setPassword("");
          setSuccessMessage(authMailMessage("signup"));
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      if (
        ["signup", "reset", "resend"].includes(mode) &&
        ((error as { status?: number })?.status === 429 ||
          [
            "over_email_send_rate_limit",
            "over_request_rate_limit",
            "email_rate_limit_exceeded",
          ].includes((error as { code?: string })?.code ?? ""))
      ) {
        mailDeadlines.current.set(mailKey, Date.now() + AUTH_MAIL_COOLDOWN_MS);
        setClock(Date.now());
      }
      if (version === lifetime.current)
        setErrorMessage(authErrorMessage(error));
    } finally {
      busy.current = false;
      if (version === lifetime.current) setIsSubmitting(false);
    }
  };

  const changeMode = (next: AuthMode) => {
    if (busy.current) return;
    lifetime.current += 1;
    setMode(next);
    setPassword("");
    setErrorMessage("");
    setSuccessMessage("");
  };
  const retrySeconds = ["signup", "reset", "resend"].includes(mode)
    ? Math.max(
        0,
        Math.ceil(
          ((mailDeadlines.current.get(
            mode + ":" + email.trim().toLowerCase(),
          ) ?? 0) -
            clock) /
            1000,
        ),
      )
    : 0;
  const label =
    mode === "signin"
      ? t("Iniciar sesión")
      : mode === "signup"
        ? t("Crear cuenta")
        : mode === "update"
          ? t("Guardar nueva contraseña")
          : mode === "reset"
            ? t("Recuperar contraseña")
            : t("Reenviar confirmación");

  return (
    <main className="auth-view min-h-screen flex items-center justify-center px-4 py-10">
      <aside className="auth-story" aria-label={t("Comunidad BuscAG")}>
        <span className="brand-wordmark">
          BuscAG
          <span>
            <ArrowUpRight size={25} aria-hidden="true" />
          </span>
        </span>
        <span className="eyebrow">{t("OBJETOS PERDIDOS. PERSONAS CONECTADAS.")}</span>
        <h2> {t("Las cosas vuelven.")} <br />
          <em>{t("Cuando nos encontramos.")}</em>
        </h2>
        <p>{t("Un pequeño gesto puede cambiar el día de alguien. Publicá, conectá y ayudá a que cada objeto vuelva a casa.")}</p>
        <div className="auth-story__note">
          <Compass aria-hidden="true" />
          <span>{t("Tu comunidad, más cerca.")}</span>
        </div>
      </aside>
      <section className="auth-card w-full max-w-md border p-7 sm:p-9">
        <LanguageSelector/><div className="flex flex-col items-center text-center mb-7">
          <div className="auth-brand-mark w-14 h-14 rounded-2xl text-white flex items-center justify-center mb-4">
            <Compass className="w-7 h-7" />
          </div>
          <h1 className="font-semibold text-2xl text-slate-900"> {t("Bienvenido a")} <span className="text-blue-800">BuscAG</span>
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {mode === "signin"
              ? t("Inicia sesión para continuar")
              : mode === "signup"
                ? t("Crea tu cuenta comunitaria")
                : label}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <label className="block text-sm font-semibold text-slate-700"> {t("Nombre completo")} <input
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="auth-input mt-1.5 w-full border px-3.5 py-2.5 font-normal outline-none"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700"> {t("Teléfono de contacto (visible al contactar tus publicaciones)")} <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="auth-input mt-1.5 w-full border px-3.5 py-2.5 font-normal outline-none"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700"> {t("Barrio o localidad")} <input
                  autoComplete="address-level2"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="auth-input mt-1.5 w-full border px-3.5 py-2.5 font-normal outline-none"
                />
              </label>
            </>
          )}
          {mode !== "update" && (
            <label className="block text-sm font-semibold text-slate-700"> {t("Correo electrónico")} <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="auth-input mt-1.5 w-full border px-3.5 py-2.5 font-normal outline-none"
              />
            </label>
          )}
          {(mode === "signin" || mode === "signup" || mode === "update") && (
            <label className="block text-sm font-semibold text-slate-700">
              {mode === "update" ? t("Nueva contraseña") : t("Contraseña")}
              <input
                required
                type="password"
                minLength={mode === "signin" ? 6 : 8}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="auth-input mt-1.5 w-full border px-3.5 py-2.5 font-normal outline-none"
              />
            </label>
          )}

          {(errorMessage || notice) && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700"
            >
              {t(errorMessage || notice || '')}
            </p>
          )}
          {successMessage && (
            <p
              role="status"
              className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700"
            >
              {t(successMessage)}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || retrySeconds > 0}
            className="auth-submit w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting && <LoaderCircle className="w-4 h-4 animate-spin" />}
            {retrySeconds > 0
              ? t('Volver a solicitar en {{seconds}}s',{seconds:retrySeconds})
              : label}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          {mode === "signin"
            ? t("¿Todavía no tienes cuenta?")
            : mode === "signup"
              ? t("¿Ya tienes una cuenta?")
              : ""}{" "}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() =>
              mode === "update"
                ? onRecovered?.()
                : changeMode(mode === "signin" ? "signup" : "signin")
            }
            className="font-bold text-blue-600 hover:text-blue-700"
          >
            {mode === "signin"
              ? t("Regístrate")
              : mode === "update"
                ? t("Volver a la aplicación")
                : t("Inicia sesión")}
          </button>
        </p>
        {(mode === "signin" || mode === "signup") && (
          <p className="text-center text-sm text-slate-500 mt-6">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => changeMode("reset")}
              className="font-bold text-blue-600 hover:text-blue-700"
            >{t("Recuperar contraseña")}</button>
            {" · "}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => changeMode("resend")}
              className="font-bold text-blue-600 hover:text-blue-700"
            >{t("Reenviar confirmación")}</button>
          </p>
        )}
      </section>
      <FaqChat />
    </main>
  );
};

import React, { useEffect, useState } from "react";
import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import en from "./locales/en.json";
const es = Object.fromEntries(Object.keys(en).map((key) => [key, key]));
let language = "es";
try {
  language = localStorage.getItem("buscag.language") === "en" ? "en" : "es";
} catch {}
void i18next.use(initReactI18next).init({
  lng: language,
  fallbackLng: "es",
  supportedLngs: ["es", "en"],
  resources: { es: { translation: es }, en: { translation: en } },
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  initAsync: false,
});
const sourceByEnglish = new Map(
  Object.entries(en).map(([source, english]) => [english, source]),
);
// Legacy domain helpers return Spanish system copy. Recognise only catalogued
// templates; this function is never applied to user posts or private messages.
const templates = Object.keys(en)
  .filter((key) => key.includes("{{"))
  .map((key) => {
    const names = [...key.matchAll(/{{(\w+)}}/g)].map((match) => match[1]);
    const escaped = key
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\{\\\{(\w+)\\\}\\\}/g, "(.+?)");
    return { key, names, pattern: new RegExp("^" + escaped + "$") };
  });
export function t(text: string, values?: Record<string, unknown>): string {
  const source = sourceByEnglish.get(text) ?? text;
  if (Object.prototype.hasOwnProperty.call(en, source))
    return i18next.t(source, values) as string;
  for (const { key, names, pattern } of templates) {
    const match = pattern.exec(source);
    if (match) {
      const data = Object.fromEntries(
        names.map((name, index) => [
          name,
          ["field", "category", "status"].includes(name)
            ? name === "category"
              ? categoryLabel(match[index + 1])
              : t(match[index + 1])
            : match[index + 1],
        ]),
      );
      return i18next.t(key, data) as string;
    }
  }
  return text;
}
/** Only translate declared category labels; preserve legacy/custom category data. */
export function categoryLabel(value: string): string {
  return [
    "Todos",
    "Todas",
    "Electrónicos",
    "Documentos y Billeteras",
    "Mascotas",
    "Llaves",
    "Mochilas y Bolsos",
    "Indumentaria",
    "Otros",
  ].includes(value)
    ? t(value)
    : value;
}
export const locale = () => (i18next.language === "en" ? "en-US" : "es-AR");
function updateLanguage() {
  if (typeof document !== "undefined")
    document.documentElement.lang = i18next.language;
  if (typeof document !== "undefined") {
    document.title = t("BuscAG · Volver a encontrar");
    document.querySelector('meta[name="description"]')?.setAttribute("content",
      t("Encontrá lo que perdiste. Ayudá a que cada objeto vuelva a casa con tu comunidad."));
  }
  try {
    localStorage.setItem("buscag.language", i18next.language);
  } catch {}
}
i18next.on("languageChanged", updateLanguage);
updateLanguage();
// A context revision updates existing views without remounting maps or drafts.
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const changed = () => setRevision((n) => n + 1);
    i18n.on("languageChanged", changed);
    return () => {
      i18n.off("languageChanged", changed);
    };
  }, [i18n]);
  useEffect(() => {
    const invalid = (event: Event) => {
      const input = event.target;
      if (!(
        input instanceof HTMLInputElement ||
        input instanceof HTMLTextAreaElement ||
        input instanceof HTMLSelectElement
      ))
        return;
      input.setCustomValidity(
        input.validity.valueMissing
          ? t("Completá este campo.")
          : input.validity.typeMismatch
            ? t("Ingresá un correo válido.")
            : t("Revisá el valor de este campo."),
      );
    };
    const clear = (event: Event) => {
      const input = event.target;
      if (
        input instanceof HTMLInputElement ||
        input instanceof HTMLTextAreaElement ||
        input instanceof HTMLSelectElement
      )
        input.setCustomValidity("");
    };
    // Keep other open tabs consistent without remounting forms or maps.
    const syncLanguage = (event: StorageEvent) => {
      if (event.key === "buscag.language") {
        const next = event.newValue === "en" ? "en" : "es";
        if (i18next.language !== next) void i18next.changeLanguage(next);
      }
    };
    window.addEventListener("storage", syncLanguage);
    document.addEventListener("invalid", invalid, true);
    document.addEventListener("input", clear, true);
    return () => {
      window.removeEventListener("storage", syncLanguage);
      document.removeEventListener("invalid", invalid, true);
      document.removeEventListener("input", clear, true);
    };
  }, []);
  useEffect(() => {
    document
      .querySelectorAll<HTMLInputElement>("input,textarea,select")
      .forEach((input) => input.setCustomValidity(""));
    document.querySelectorAll(".leaflet-control-zoom-in").forEach((el) => {
      el.setAttribute("title", t("Acercar"));
      el.setAttribute("aria-label", t("Acercar"));
    });
    document.querySelectorAll(".leaflet-control-zoom-out").forEach((el) => {
      el.setAttribute("title", t("Alejar"));
      el.setAttribute("aria-label", t("Alejar"));
    });
  }, [revision]);
  return (
    <LanguageRevision.Provider value={revision}>
      {children}
    </LanguageRevision.Provider>
  );
}
export const LanguageRevision = React.createContext(0);
export function useLanguage() {
  return React.useContext(LanguageRevision);
}
export function LanguageSelector() {
  const { i18n } = useTranslation();
  return (
    <label className="language-selector">
      <span className="sr-only">{t("Idioma")}</span>
      <select
        aria-label={t("Idioma")}
        value={i18n.language}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
      >
        <option value="es">ES</option>
        <option value="en">EN</option>
      </select>
    </label>
  );
}
export default i18next;

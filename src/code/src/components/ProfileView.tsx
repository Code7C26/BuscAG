import {ProfileSettings} from './ProfileSettings';
import React, { useId, useRef, useState, useEffect } from "react";
import { Avatar } from "./Avatar";
import { ItemCard } from "./ItemCard";
import type { User, Item } from "../types";
import {
  ShieldCheck,
  CheckCircle2,
  Package,
  LogOut,
  Trash2,
  Plus,
  Sparkles,
  MapPin,
  LockKeyhole,
  Bell,
  KeyRound,
  ArrowUpRight,
  LoaderCircle,
  Settings2,
} from "lucide-react";
interface ProfileViewProps {
  onProfileSaved?: () => void;
  currentUser: User;
  userItems: Item[];
  onSignOut: () => void;
  isSigningOut?: boolean;
  signOutError?: string;
  onEditItem?: (item: Item) => void;
  onChangePassword?: () => void;
  onViewItem: (item: Item) => void;
  onOpenPublish: () => void;
  onDeleteItem: (id: string) => void;
  onGoToMatches?: () => void;
  userMatchesCount?: number;
  pushBusy?: boolean;
  pushEnabled: boolean;
  onTogglePush: (enabled: boolean) => void;
}
type ProfileTab = "published" | "recovered" | "settings";
export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onProfileSaved,
  userItems,
  onSignOut,
  isSigningOut = false,
  signOutError = "",
  onEditItem,
  onChangePassword,
  onViewItem,
  onOpenPublish,
  onDeleteItem,
  onGoToMatches,
  userMatchesCount = 0,
  pushBusy=false,
  pushEnabled,
  onTogglePush,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ProfileTab>("published");
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabId = useId();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [currentUser.id]);
  const published = userItems.filter((item) => item.status !== "recuperado");
  const recovered = userItems.filter((item) => item.status === "recuperado");
  const tabs: { id: ProfileTab; label: string; count?: number }[] = [
    { id: "published", label: "Publicaciones", count: published.length },
    { id: "recovered", label: "Recuperados", count: recovered.length },
    { id: "settings", label: "Configuración" },
  ];
  const tabKey = (event: React.KeyboardEvent, index: number) => {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index + tabs.length - 1) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setActiveSubTab(tabs[next].id);
    tabsRef.current
      ?.querySelectorAll<HTMLButtonElement>("[role=tab]")
      [next]?.focus();
  };
  return (
    <section
      className="profile-view account-workspace"
      aria-labelledby="account-title"
    >
      <header className="workspace-heading">
        <div>
          <span className="eyebrow">MI ESPACIO EN BUSCAG</span>
          <h1 id="account-title">Tu cuenta, tu comunidad.</h1>
          <p>Gestioná tus publicaciones y elegí cómo querés conectar.</p>
        </div>
        <button className="button-primary" onClick={onOpenPublish}>
          <Plus size={18} />
          Publicar un objeto
        </button>
      </header>
      <div className="account-layout">
        <aside className="account-sidebar" aria-label="Resumen de tu cuenta">
          <section className="account-identity">
            <div className="account-identity__cover">
              <span>
                <LockKeyhole size={14} /> Sólo vos ves tus datos privados
              </span>
            </div>
            <div className="account-identity__body">
              <Avatar
                src={currentUser.avatar}
                name={currentUser.name}
                className="account-avatar"
              />
              <h2>{currentUser.name || "Tu cuenta"}</h2>
              <p className="account-email">{currentUser.email}</p>
              {currentUser.verified && (
                <span className="account-verification">
                  <ShieldCheck size={15} />
                  Correo confirmado
                </span>
              )}
              {currentUser.location && (
                <p className="account-location">
                  <MapPin size={15} />
                  {currentUser.location}
                </p>
              )}
              <button
                type="button"
                onClick={onSignOut}
                disabled={isSigningOut}
                aria-busy={isSigningOut}
                className="account-signout"
              >
                {isSigningOut ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <LogOut size={18} />
                )}
                <span>
                  {isSigningOut ? "Cerrando sesión…" : "Cerrar sesión"}
                </span>
                <ArrowUpRight size={16} />
              </button>
              <p className="account-session-note">
                Salís de este dispositivo. Tus publicaciones y conversaciones se
                conservan.
              </p>
              {signOutError && (
                <p role="alert" className="account-error">
                  {signOutError}
                </p>
              )}
            </div>
          </section>
          <dl className="account-stats">
            <div>
              <dt>Publicaciones</dt>
              <dd>{userItems.length}</dd>
            </div>
            <div>
              <dt>Recuperados</dt>
              <dd>{recovered.length}</dd>
            </div>
            <div>
              <dt>{currentUser.ratingCount ? `Calificación · ${currentUser.ratingCount} valoraciones` : 'Sin valoraciones'}</dt>
              <dd>{currentUser.ratingCount ? `${currentUser.rating}/5` : '—'}</dd>
            </div>
          </dl>
          <section className="account-privacy-note">
            <LockKeyhole size={20} />
            <div>
              <h3>Tu privacidad, primero</h3>
              <p>
                Tu correo no es público. El teléfono y la localidad se comparten
                sólo después de intercambiar mensajes sobre un mismo objeto.
              </p>
            </div>
          </section>
        </aside>
        <div className="account-content">
          <div
            className="account-tabs"
            role="tablist"
            aria-label="Secciones de tu perfil"
            ref={tabsRef}
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                role="tab"
                id={`${tabId}-${tab.id}`}
                aria-controls={`${tabId}-panel`}
                aria-selected={activeSubTab === tab.id}
                tabIndex={activeSubTab === tab.id ? 0 : -1}
                onKeyDown={(event) => tabKey(event, index)}
                onClick={() => setActiveSubTab(tab.id)}
              >
                {tab.label}
                {tab.count !== undefined && <span>{tab.count}</span>}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`${tabId}-panel`}
            aria-labelledby={`${tabId}-${activeSubTab}`}
            tabIndex={0}
            className={`account-panel ${activeSubTab==='settings'?'account-panel--settings':''}`}
          >
            {activeSubTab === "settings" ? (
              <>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">A TU MEDIDA</span>
                    <h2>Privacidad y configuración</h2>
                    <p>Opciones claras. Vos tenés el control.</p>
                  </div>
                  <Settings2 size={24} />
                </div>
                <ProfileSettings key={currentUser.id} userId={currentUser.id} onSaved={onProfileSaved}/>
                <section
                  className="settings-group"
                  aria-labelledby={`${tabId}-notices`}
                >
                  <h3 id={`${tabId}-notices`}>Notificaciones</h3>
                  <label className="settings-row">
                    <span className="settings-icon">
                      <Bell size={20} />
                    </span>
                    <span className="settings-copy">
                      <strong>Notificaciones push</strong>
                      <small>
                        Avisos en este dispositivo, incluso con BuscAG cerrado.
                        En iPhone: iOS 16.4 o posterior, agregá BuscAG a la pantalla
                        de inicio y activá los avisos desde su icono.
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label="Activar notificaciones push"
                      disabled={pushBusy}
                      aria-busy={pushBusy}
                      checked={pushEnabled}
                      onChange={(event) => onTogglePush(event.target.checked)}
                    />
                  </label>
                  <p role="status" className="text-xs px-4 pb-3">{pushBusy?"Actualizando permisos del dispositivo…":pushEnabled?"Suscripción de este dispositivo activada. La entrega depende del servicio y de los permisos del sistema.":"Avisos externos desactivados en este dispositivo. Las notificaciones internas siguen disponibles."}</p>
                </section>
                <section
                  className="settings-group"
                  aria-labelledby={`${tabId}-security`}
                >
                  <h3 id={`${tabId}-security`}>Seguridad de la cuenta</h3>
                  {onChangePassword && (
                    <button
                      className="settings-row settings-action"
                      onClick={onChangePassword}
                    >
                      <span className="settings-icon">
                        <KeyRound size={20} />
                      </span>
                      <span className="settings-copy">
                        <strong>Cambiar contraseña</strong>
                        <small>
                          Elegí una contraseña única para proteger tu cuenta.
                        </small>
                      </span>
                      <ArrowUpRight size={18} />
                    </button>
                  )}
                  <div className="settings-row">
                    <span className="settings-icon">
                      <MapPin size={20} />
                    </span>
                    <span className="settings-copy">
                      <strong>Ubicación bajo tu control</strong>
                      <small>
                        El GPS se solicita cuando lo usás. No se guarda
                        automáticamente en tu perfil.
                      </small>
                    </span>
                  </div>
                </section>
                <div className="settings-information">
                  <LockKeyhole size={17} />
                  <p>
                    Cerrar sesión no elimina tu cuenta. Para salir, usá el botón
                    visible en tu tarjeta de perfil.
                  </p>
                </div>
              </>
            ) : (
              <>
                {activeSubTab === "published" &&
                  userMatchesCount > 0 &&
                  onGoToMatches && (
                    <div className="account-match-callout">
                      <Sparkles size={22} />
                      <div>
                        <strong>
                          {userMatchesCount} posibles coincidencias
                        </strong>
                        <p>
                          Revisá objetos que podrían estar relacionados con tus
                          publicaciones.
                        </p>
                      </div>
                      <button
                        onClick={onGoToMatches}
                        aria-label="Ver coincidencias"
                      >
                        <ArrowUpRight size={20} />
                      </button>
                    </div>
                  )}
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {activeSubTab === "published"
                        ? "MIS PUBLICACIONES"
                        : "HISTORIAS QUE VUELVEN"}
                    </span>
                    <h2>
                      {activeSubTab === "published"
                        ? "Tus publicaciones activas"
                        : "Objetos recuperados"}
                    </h2>
                    <p>
                      {activeSubTab === "published"
                        ? "Editá la información o gestioná la confirmación de recuperación."
                        : "Cada encuentro cuenta. Tus conversaciones se conservan."}
                    </p>
                  </div>
                </div>
                {(activeSubTab === "published" ? published : recovered)
                  .length === 0 ? (
                  <div className="account-empty">
                    {activeSubTab === "published" ? (
                      <Package size={38} />
                    ) : (
                      <CheckCircle2 size={38} />
                    )}
                    <h3>
                      {activeSubTab === "published"
                        ? "Tu próxima conexión empieza acá"
                        : "Todavía no hay objetos recuperados"}
                    </h3>
                    <p>
                      {activeSubTab === "published"
                        ? "Publicá lo que encontraste o lo que estás buscando. La comunidad puede ayudarte."
                        : "Cuando se confirme la recuperación de uno de tus objetos, aparecerá en este espacio."}
                    </p>
                    {activeSubTab === "published" && (
                      <button
                        className="button-primary"
                        onClick={onOpenPublish}
                      >
                        <Plus size={18} />
                        Crear publicación
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="account-items">
                    {(activeSubTab === "published" ? published : recovered).map(
                      (item) => (
                        <div key={item.id} className="account-item">
                          <ItemCard currentUserId={currentUser.id} item={item} onViewMore={onViewItem} />
                          {activeSubTab === "published" && (
                            <div className="account-item-actions">
                              {onEditItem && (
                                <button onClick={() => onEditItem(item)}>
                                  Editar
                                </button>
                              )}
                              <button
                                className="recover-action"
                                onClick={() => onViewItem(item)}
                              >
                                <CheckCircle2 size={16} />
                                Gestionar recuperación
                              </button>
                              <button
                                className="delete-action"
                                onClick={() => onDeleteItem(item.id)}
                                aria-label={`Eliminar ${item.title || "publicación"}`}
                                title="Eliminar publicación"
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

import {schedule} from '../server/model.mjs';
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Maximize,
  Radio,
  Check,
  Layers,
  Compass,
  Code2,
  Users,
  Hand,
  Search,
  ShieldCheck,
  MapPin,
  Clock3,
  Volume2,
  RotateCcw,
  Wifi,
  WifiOff,
} from "lucide-react";
import QRCode from "qrcode";
import {
  api,
  control,
  fmt,
  original,
  Project,
  Scene,
  Live,
  Poll,
} from "./store";
import { Studio } from "./studio";
import codeEvidence from "./code-evidence.json";
import {CinemaVisual} from "./cinema";
import {voteUrl,safeLink} from "../server/public-links.mjs";
import {VotingSettings} from "./voting-settings";
function useLive() {
  const [live, setLive] = useState<Live | null>(null),
    [online, setOnline] = useState(false),
    [project, setProject] = useState<Project>(original());
  useEffect(() => {
    let active = true;
    let revision:number|undefined;
    api<Project>("/api/project")
      .then((p) => active && setProject(p))
      .catch(() => {});
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      setOnline(true);
      const next=JSON.parse(e.data);
      if(next.projectRevision!==revision){revision=next.projectRevision;api<Project>("/api/project").then(p=>active&&setProject(p)).catch(()=>{});}
      setLive(next);
      if(["/presenter","/studio","/admin"].includes(location.pathname))api<Live>("/api/admin/state").then(setLive).catch(()=>{});
    };
    es.onerror = () => setOnline(false);
    const timer = setInterval(
      () =>
        api<Project>("/api/project")
          .then((p) => active && setProject(p))
          .catch(() => {}),
      10000,
    );
    return () => {
      active = false;
      es.close();
      clearInterval(timer);
    };
  }, []);
  return { live, online, project, setProject };
}
export function QR({ value, label }: { value: string; label?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    setUrl("");
    if (safeLink(value))
      QRCode.toDataURL(value, {
        width: 560,
        margin: 4,
        errorCorrectionLevel: "M",
        color: { dark: "#061327", light: "#ffffff" },
      }).then((v) => active && setUrl(v));
    return () => {
      active = false;
    };
  }, [value]);
  return (
    <div className="qr">
      {url ? (
        <img src={url} alt={"QR: " + (label || value)} />
      ) : (
        <div className="pending">Enlace pendiente</div>
      )}
      {label && <span>{label}</span>}
    </div>
  );
}
function Brand({ logo }: { logo?: string }) {
  return (
    <div className="brand">
      <img
        src={logo ? "/media/" + logo : "/brand/icon.svg"}
        alt="Símbolo original BuscAG"
      />
      <span>
        Busc<span className="accent">AG</span>
      </span>
    </div>
  );
}
function VoteBars({
  poll,
  rehearsal,
  samples,
}: {
  poll?: Poll;
  rehearsal: boolean;
  samples?: number[];
}) {
  if (!poll) return <p>Conectando encuesta…</p>;
  const manual = poll.source === "hands";
  const counts = rehearsal && !manual
      ? poll.options.map((_, i) => samples?.[i] || 0)
      : poll.counts,
    total = rehearsal && !manual ? counts!.reduce((a, b) => a + b, 0) : poll.total;
  return (
    <div className="vote-bars">
      <div className="poll-status">
        <span className={poll.open ? "live-dot" : ""} />
        {manual ? "CONTEO MANUAL · MANOS LEVANTADAS" : rehearsal
          ? "ENSAYO · DATOS FICTICIOS"
          : poll.open
            ? "VOTACIÓN ABIERTA"
            : "VOTACIÓN CERRADA"}
        <b>{manual ? total + " manos contadas" : rehearsal ? total + " ficticios" : total + " votos"}</b>
      </div>
      {poll.options.map((o, i) => {
        const pct = counts && total ? Math.round((counts[i] / total) * 100) : 0;
        return (
          <div className="bar-row" key={i}>
            <div>
              <span>
                {String(i + 1).padStart(2, "0")} <strong>{o}</strong>
              </span>
              <b>{counts ? pct + "%" : "—"}</b>
            </div>
            <div className="bar-track">
              <motion.div
                animate={{ width: pct + "%" }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>
        );
      })}
      {!counts && (
        <p className="muted">
          Resultados ocultos hasta que el presentador los revele.
        </p>
      )}
      {!rehearsal && poll.reveal && (
        <p className="winner">
          {poll.winners.length === 1
            ? "Elegido: " + poll.options[poll.winners[0]]
            : poll.winners.length > 1
              ? "Empate · decidirlo en sala"
              : "Todavía no hay votos."}
        </p>
      )}
    </div>
  );
}
function Argentina() {
  return (
    <svg
      className="argentina"
      viewBox="0 0 560 650"
      role="img"
      aria-label="Mapa estilizado de Argentina, visión futura"
    >
      <defs>
        <linearGradient id="land" x2="1" y2="1">
          <stop stopColor="#1763b5" stopOpacity=".5" />
          <stop offset="1" stopColor="#60c8ff" stopOpacity=".05" />
        </linearGradient>
      </defs>
      <path
        d="M270 38 340 72 365 129 417 166 396 204 356 211 340 259 315 300 311 342 285 380 289 424 262 459 252 510 226 551 242 587 213 610 183 586 179 543 150 501 157 460 143 412 157 370 148 324 169 275 162 233 190 191 189 145 220 106 230 63Z"
        fill="url(#land)"
        stroke="#60c8ff"
        strokeWidth="2"
      />
      {[
        [276, 151],
        [308, 243],
        [247, 292],
        [281, 351],
        [229, 436],
        [208, 524],
      ].map(([x, y], i) => (
        <g
          key={i}
          style={{ animationDelay: i * 0.5 + "s" }}
          className="map-node"
        >
          <path
            d={`M281 351 Q${x + 65} ${y - 60} ${x} ${y}`}
            fill="none"
            stroke="#60c8ff"
            opacity=".5"
          />
          <circle cx={x} cy={y} r="6" fill="#a1e7ff" />
          <circle
            cx={x}
            cy={y}
            r="16"
            fill="none"
            stroke="#60c8ff"
            opacity=".25"
          />
        </g>
      ))}
      <text x="310" y="575" fill="#91a7c4" fontSize="16">
        VISIÓN FUTURA
      </text>
    </svg>
  );
}
function Video({ scene, p }: { scene: Scene; p: Project }) {
  const ref = useRef<HTMLVideoElement>(null),
    [error, setError] = useState(""),
    [duration, setDuration] = useState(0);
  const url = scene.media ? "/media/" + scene.media : "";
  return (
    <div className="video-wrap">
      {url ? (
        <>
          <video
            key={url}
            ref={ref}
            src={url}
            controls
            preload="metadata"
            playsInline
            onLoadedMetadata={() => {
              const d = ref.current?.duration || 0;
              setDuration(d);
              if (scene.kind === "video" && Math.abs(d - 60) > 0.25)
                setError(
                  "Duración " +
                    d.toFixed(2) +
                    " s: se requiere el original de 60 s.",
                );
            }}
            onError={() =>
              setError("No se pudo reproducir. Revisar archivo y códec.")
            }
          />
          <div className="media-actions">
            <button
              onClick={() =>
                ref.current
                  ?.play()
                  .catch(() =>
                    setError(
                      "El navegador requiere una interacción para reproducir.",
                    ),
                  )
              }
            >
              <Play size={16} />
              Reproducir
            </button>
            <button onClick={() => ref.current?.pause()}>
              <Pause size={16} />
              Pausar
            </button>
            <button
              onClick={() => {
                if (ref.current) ref.current.currentTime = 0;
              }}
            >
              <RotateCcw size={16} />
              Reiniciar
            </button>
            <label>
              <Volume2 size={16} />
              <input
                aria-label="Volumen"
                type="range"
                min="0"
                max="1"
                step=".05"
                defaultValue="1"
                onChange={(e) => {
                  if (ref.current) ref.current.volume = Number(e.target.value);
                }}
              />
            </label>
          </div>
          {error && <p className="warning">{error}</p>}
          <small>
            {scene.kind === "video"
              ? "ORIGINAL EN INGLÉS · AUDIO SIN MODIFICAR"
              : p.assets.find((a) => a.id === scene.media)?.name}{" "}
            · {duration.toFixed(1)} s
          </small>
        </>
      ) : (
        <div className="video-placeholder">
          <Play size={62} />
          <p>
            {scene.kind === "video"
              ? "Video publicitario BuscAG — pendiente de incorporar"
              : "Grabación real de respaldo — pendiente"}
          </p>
          <small>
            {scene.kind === "video"
              ? "60 segundos · Valentino + Germán · audio original"
              : "Cargar evidencia auténtica desde Studio"}
          </small>
        </div>
      )}
    </div>
  );
}
const icons = [<Search />, <MapPin />, <Compass />, <ShieldCheck />];
export function Slide({
  scene: s,
  p,
  live,
  preview = false,
}: {
  scene: Scene;
  p: Project;
  live: Live | null;
  preview?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const play = () => {
      if ((window as any).buscagAudio) audioRef.current?.play().catch(() => {});
    };
    play();
    window.addEventListener("buscag-start", play);
    return () => window.removeEventListener("buscag-start", play);
  }, [s.id, s.sound]);
  const reduced = p.reducedMotion || p.performanceMode === "low" || s.animation === "none";
  const index = p.scenes.findIndex((x) => x.id === s.id);
  const pollId =
    (s as any).pollId || (s.id === "scene-03" ? "search" : "object");
  const poll = live?.polls.find((x) => x.id === pollId);
  const media = p.assets.find((a) => a.id === s.media);
  const image =
    s.media && media?.type.startsWith("image/") ? "/media/" + s.media : "";
  const text = (
    <div
      className="slide-copy"
      style={
        {
          "--type-scale": s.fontSize,
          transform: `translate(${s.x}%,${s.y}%)`,
        } as React.CSSProperties
      }
    >
      <p className="eyebrow">
        <span /> {s.kind === "signal" ? "EXPERIMENTO 001" : s.kicker}
      </p>
      <h1>{s.kind === "poll" ? poll?.question || s.title : s.title}</h1>
      <p className="subtitle">{s.subtitle}</p>
      {!["signal", "team", "audience", "poll", "video", "closing", "vision", "viability", "architecture", "code", "challenge", "testing", "value", "management"].includes(s.kind) && (
        <div className="bullets">
          {s.bullets.map((b, i) => (
            <motion.div
              key={b}
              initial={reduced ? false : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.13 }}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <p>{b}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
  let visual: React.ReactNode;
  if (s.kind === "signal" || s.kind === "closing")
    visual = (
      <div className="connection-art">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="connection-line" />
        <div className="point left" />
        <div className="point right" />
        <div className="logo-reveal">
          <img src="/brand/icon.svg" alt="BuscAG" />
          <span>
            Busc<span>AG</span>
          </span>
        </div>
        <p>
          DOS PERSONAS. UN MISMO OBJETIVO.
          <br />
          UNA POSIBILIDAD DE CONEXIÓN.
        </p>
      </div>
    );
  else if (s.kind === "poll")
    visual = (
      <div className="poll-visual">
        {!live?.rehearsal&&live?.inputSource!=="hands"&&!live?.voting?.connected&&<p className="poll-offline-warning">SIN CONEXIÓN · resultados detenidos. Podemos votar levantando la mano.</p>}
        <VoteBars
          poll={poll}
          rehearsal={live?.rehearsal ?? true}
          samples={live?.rehearsalCounts?.[pollId]}
        />
        <div className="poll-join">
          {live?.inputSource === "hands" ? <div className="hands-cue"><Hand/><strong>LEVANTÁ<br/>LA MANO</strong></div> : <QR value={voteUrl(live?.voting?.origin || "",pollId)} label="Escaneá para participar"/>}
          <p>
            {live?.inputSource === "hands" ? "Sin internet: elegimos en sala." : !live?.voting?.connected ? "Servicio HTTPS pendiente o desconectado." : "Tu respuesta."}
            <br />
            <strong>La próxima conexión.</strong>
            <small>
              Una respuesta por sesión.
              <br />
              Sin nombre ni correo.
            </small>
          </p>
        </div>
      </div>
    );
  else if (s.kind === "reveal")
    visual = (
      <div className="mockups">
        <div className="browser-mock">
          <div className="browser-bar">
            <i />
            <i />
            <i />
            <span>BuscAG / interfaz del repositorio</span>
          </div>
          <img
            src={image || "/captures/home-desktop.png"}
            alt="Captura de la interfaz BuscAG"
          />
        </div>
        <div className="phone-mock">
          <img
            src="/captures/home-phone.png"
            alt="Captura de interfaz móvil BuscAG"
          />
        </div>
        <small className="capture-label">
          INTERFAZ REAL · BACKEND Y DATOS SINTÉTICOS
        </small>
      </div>
    );
  else if (s.kind === "scatter")
    visual = (
      <div className="scatter-art">
        {s.bullets.map((v, i) => (
          <div className={"scattered card-" + i} key={i}>
            <span>CAMPO {i + 1} / PUBLICACIÓN</span>
            <p>{v}</p>
            <div className="fake-line" />
            <div className="fake-line short" />
          </div>
        ))}
        <div className="central-mark">
          <img src="/brand/icon.svg" alt="BuscAG centraliza" />
        </div>
      </div>
    );
  else if (s.kind === "architecture")
    visual = (
      <div className="layer-stack">
        {[
          "INTERFAZ / React + Vite",
          "LÓGICA / coincidencias y mensajes",
          "DATOS / Supabase + PostgreSQL",
          "SEGURIDAD / Auth + RLS",
        ].map((v, i) => (
          <div style={{ "--i": i } as React.CSSProperties} key={v}>
            <Layers />
            <b>{v}</b>
            <span>0{i + 1}</span>
          </div>
        ))}
        <small>
          Hosting configurado: Firebase · despliegue activo por comprobar
        </small>
      </div>
    );
  else if (s.kind === "code")
    visual = (
      <div className="code-panel">
        <div className="browser-bar">
          <i />
          <i />
          <i />
          <span>matcher.ts · fragmento auténtico</span>
        </div>
        <pre>{codeEvidence.code}</pre>
        <small>Referencia del fragmento: docs/CODE_EVIDENCE.md</small>
      </div>
    );
  else if (s.kind === "costs")
    visual = (
      <div className="cost-panel">
        <p className="eyebrow">ESTIMACIONES · ARS</p>
        <strong>$1.730.700</strong>
        <p>180 horas de desarrollo web</p>
        <div className="cost-line" />
        <div className="cost-grid">
          <div>
            <b>$39.250</b>
            <small>por mes · fijo directo</small>
          </div>
          <div>
            <b>$479.500</b>
            <small>por año · incluye dominio</small>
          </div>
        </div>
        <small>Fuente: informe adjunto · no son gastos ejecutados</small>
      </div>
    );
  else if (s.kind === "video") visual = <Video scene={s} p={p} />;
  else if (s.kind === "vision") visual = <Argentina />;
  else if (s.kind === "invite" || s.kind === "closing")
    visual = (
      <div className="qr-pair">
        <QR value={p.links.web} label="Web de BuscAG" />
        <QR value={p.links.github} label="GitHub · requiere acceso" />
        <nav className="audit-links">
          <a href={p.links.readme} target="_blank" rel="noreferrer">
            README técnico ↗
          </a>
          <a href={p.links.manual} target="_blank" rel="noreferrer">
            Manual de usuario ↗
          </a>
          <a href="/docs/Informe.pdf" target="_blank" rel="noreferrer">
            Informe completo ↗
          </a>
        </nav>
      </div>
    );
  else if (s.kind === "demo")
    visual = (
      <div className="demo-panel">
        <div className="demo-status">
          <Radio /> MVP / DOS SESIONES INDEPENDIENTES
        </div>
        {s.media ? (
          <Video scene={s} p={p} />
        ) : (
          <>
            <div className="two-accounts">
              <div>
                <Users />
                <b>Valentino</b>
                <span>PERFIL A</span>
              </div>
              <div className="dash-connection" />
              <div>
                <Users />
                <b>Germán</b>
                <span>PERFIL B</span>
              </div>
            </div>
            <p>La evidencia está en el sistema real.</p>
            <a
              href={p.links.web}
              target="buscag-demo"
              rel="noreferrer"
              className="primary"
            >
              Abrir MVP de prueba <ArrowUpRight size={18} />
            </a>
            <small>
              URL prevista · disponibilidad y flujo real pendientes de ensayo
            </small>
          </>
        )}
        {live?.connection && (
          <motion.div
            className="connection-confirmed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Check /> CONEXIÓN ENCONTRADA
            <small>Activada manualmente tras verificar el sistema</small>
          </motion.div>
        )}
      </div>
    );
  else if (s.kind === "team")
    visual = (
      <div className="team-art">
        {["V", "G"].map((v, i) => (
          <div key={v}>
            <span>{v}</span>
            <p>{i ? "Germán Luján" : "Valentino Mamonde"}</p>
            <small>
              {i ? "Marketing + documentación" : "Desarrollo + investigación"}
            </small>
          </div>
        ))}
      </div>
    );
  else if (s.kind === "marketing")
    visual = (
      <div className="marketing-art">
        <div className="flyer-mini">
          <Brand />
          <h2>
            ¿Lo perdiste?
            <br />
            <em>Conectemos.</em>
          </h2>
          <QR value={p.links.web} />
          <small>PROPUESTA EDITABLE · BUSCAG</small>
        </div>
        <div className="sticker-mini">
          <img src="/brand/icon.svg" alt="Sticker propuesto" />
          <span>
            Encontrarnos
            <br />
            hace la diferencia.
          </span>
        </div>
      </div>
    );
  else
    visual = (
      <div className="concept-art">
        {s.bullets.map((b, i) => (
          <div key={b}>
            <div className="concept-icon">{icons[i % icons.length]}</div>
            <span>0{i + 1}</span>
            <h3>{b}</h3>
          </div>
        ))}
        <div className="concept-line" />
      </div>
    );
  if (
    s.media &&
    media?.type.startsWith("video/") &&
    !["video", "demo"].includes(s.kind)
  )
    visual = <Video scene={s} p={p} />;
  if (image && !["reveal", "video", "demo"].includes(s.kind))
    visual = (
      <img
        className="custom-visual"
        src={image}
        alt={media?.name || "Imagen de escena"}
      />
    );
  visual = <CinemaVisual scene={s} p={p} live={live} fallback={visual}/>;
  return (
    <MotionConfig reducedMotion={p.reducedMotion || p.performanceMode === "low" ? "always" : "user"}>
      <section
        className={`slide cinema-slide act-${s.act} kind-${s.kind} layout-${s.layout} ${preview ? "is-preview" : ""} ${reduced ? "no-motion" : ""}`}
        style={
          {
            background: s.background,
            "--accent": p.theme.accent,
            "--ink": p.theme.text,
            fontFamily: p.theme.font,
          } as React.CSSProperties
        }
      >
        {s.sound && (
          <audio
            ref={audioRef}
            className={preview ? "scene-audio" : "scene-audio hidden-audio"}
            src={
              s.sound === "builtin-connection"
                ? "/sounds/connection.wav"
                : "/media/" + s.sound
            }
            controls={preview}
            preload="auto"
          />
        )}
        <div className="grid-bg" />
        <div className="ambient ambient-a" />
        <div className="ambient ambient-b" />
        <header className="slide-header">
          <Brand logo={p.logo} />
          <span>
            THE EXPERIMENT <span className="header-line" /> PRESENTACIÓN FINAL
          </span>
          <span>ACTO {s.act} / 6</span>
        </header>
        <motion.div
          key={s.id}
          className="slide-body"
          initial={
            reduced
              ? false
              : {
                  opacity: 0,
                  y: s.animation === "rise" ? 40 : 0,
                  scale: s.animation === "cinematic" ? 0.97 : 1,
                }
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65 / s.speed }}
        >
          {text}
          <div className="visual">{visual}</div>
        </motion.div>
        <footer className="slide-footer">
          <span>ENCONTRARNOS HACE LA DIFERENCIA.</span>
          <div className="chapter-progress">
            {Array.from({ length: 6 }, (_, i) => (
              <i
                key={i}
                className={i < s.act ? "filled" : ""}
              />
            ))}
          </div>
          <span>
            {String(index + 1).padStart(2, "0")}{" "}
            <span className="muted">/ {p.scenes.length}</span>
          </span>
        </footer>
        {s.kind === "closing" && (
          <div className="closing-links">
            <QR value={p.links.web} label="Abrí BuscAG" />
            <QR value={p.links.github} label="GitHub · requiere acceso" />
          </div>
        )}
      </section>
    </MotionConfig>
  );
}
function VotePage({
  live,
  online,
  p,
}: {
  live: Live | null;
  online: boolean;
  p: Project;
}) {
  const id = new URLSearchParams(location.search).get("poll") || "search",
    poll = live?.polls.find((v) => v.id === id);
  const [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false),
    [voted, setVoted] = useState(false);
  return (
    <main className="vote-page">
      <Brand />
      <p className="eyebrow">EL EXPERIMENTO · TU VOZ</p>
      <h1>{poll?.question || "Conectando con la presentación…"}</h1>
      <p>
        {!online
          ? "Sin conexión. Esperá a que vuelva la red."
          : live?.rehearsal
            ? "Ensayo: la votación real está desactivada."
            : poll?.open
              ? "Elegí una opción."
              : "La encuesta todavía no está abierta."}
      </p>
      <div className="mobile-options">
        {poll?.options.map((o, i) => (
          <button
            key={o}
            disabled={!online || !poll.open || live?.rehearsal || busy || voted}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/api/vote", "POST", { poll: id, choice: i });
                setMsg("Tu voto quedó registrado.");
                setVoted(true);
              } catch (e) {
                setMsg((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <span>0{i + 1}</span>
            {o}
            <ArrowRight />
          </button>
        ))}
      </div>
      <p role="status">{msg}</p>
      <small>
        Un voto por encuesta y sesión del navegador. Sin nombre ni correo.
        Borrar cookies o usar otro navegador permite repetir; esta mitigación no
        identifica personas.
      </small>
      <a href={p.links.github}>
        Conocé el proyecto <ArrowUpRight size={16} />
      </a>
    </main>
  );
}
function Auth({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState(""),
    [msg, setMsg] = useState("");
  return (
    <main className="auth">
      <Brand />
      <div className="auth-box">
        <p className="eyebrow">ACCESO PRIVADO</p>
        <h1>Detrás del experimento.</h1>
        <p>Presentador y BuscAG Studio</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("/api/login", "POST", { password });
              setPassword("");
              onSuccess();
            } catch (err) {
              setMsg((err as Error).message);
            }
          }}
        >
          <label>
            Contraseña
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="primary">
            Ingresar <ArrowRight size={18} />
          </button>
        </form>
        <p role="status" className="warning">
          {msg}
        </p>
        <small>
          Primera vez: ejecutar npm run setup en la PC que sirve la
          presentación.
        </small>
      </div>
    </main>
  );
}
function Presenter({
  live,
  online,
  p,
}: {
  live: Live;
  online: boolean;
  p: Project;
}) {
  const [privateP, setP] = useState<Project>(p),
    [msg, setMsg] = useState(""),
    [now, setNow] = useState(Date.now());
  const scenes = privateP.scenes.filter((s) => !s.hidden),
    index = Math.max(
      0,
      scenes.findIndex((s) => s.id === live.sceneId),
    ),
    scene = scenes[index],
    next = scenes[index + 1];
  useEffect(() => {
    api<Project>("/api/admin/project")
      .then(setP)
      .catch((e) => setMsg(e.message));
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const elapsed = live.elapsed + (live.running ? (now - live.at) / 1000 : 0),
    start = scenes.slice(0, index).reduce((a, b) => a + b.duration, 0),
    late = elapsed > start + scene.duration;
  async function act(body: unknown) {
    try {
      await control(body);
      setMsg("");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;
      if (e.key === "ArrowRight" && next) act({ action: "scene", id: next.id });
      if (e.key === "ArrowLeft" && index > 0)
        act({ action: "scene", id: scenes[index - 1].id });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, live.sceneId]);
  const modeChange = () => act({ action: "rehearsal", value: !live.rehearsal });
  return (
    <main className="presenter">
      <header className="control-header">
        <Brand />
        <span>
          <span className={online ? "status-good" : "warning"}>
            {online ? <Wifi size={16} /> : <WifiOff size={16} />}{" "}
            {online ? "Conectado" : "Sin conexión"}
          </span>
        </span>
        <a href="/studio">
          BuscAG Studio <ArrowUpRight size={16} />
        </a>
        <a href="/" target="buscag-public">
          Abrir proyector <Maximize size={16} />
        </a>
        <button
          onClick={() =>
            api("/api/logout", "POST").then(() => location.reload())
          }
        >
          Salir
        </button>
      </header>
      {live.legacyProject&&<p className="warning panel">Proyecto anterior preservado. Exportalo desde Studio y restaurá la plantilla nueva para usar las 24 escenas en 25 minutos; no se sobreescribió tu guion.</p>}<div className="presenter-grid">
        <div>
          <div className="preview-frame">
            <Slide scene={scene} p={privateP} live={live} preview />
          </div>
          <div className="presenter-nav">
            <button
              disabled={index === 0}
              onClick={() => act({ action: "scene", id: scenes[index - 1].id })}
            >
              <ChevronLeft />
              Anterior
            </button>
            <span>
              {index + 1} / {scenes.length}
            </span>
            <button
              disabled={!next}
              onClick={() => act({ action: "scene", id: next.id })}
            >
              Siguiente
              <ChevronRight />
            </button>
          </div>
          <div className="notes">
            <p className="eyebrow">
              GUION PRIVADO / {scene.speaker} / {fmt(start)}–
              {fmt(start + scene.duration)}
            </p>
            <h2>{scene.title}</h2>
            <p>{scene.script}</p>
            <blockquote>{scene.actions}</blockquote>
          </div>
        </div>
        <aside>
          <div className={"clock-panel " + (late ? "over-time" : "")}>
            <p className="eyebrow">TIEMPO TOTAL</p>
            <strong>{fmt(elapsed)}</strong>
            <p>
              Objetivo {fmt(schedule(privateP).target)} ·{" "}
              {late
                ? "Revisar ritmo de esta escena"
                : "Escena hasta " + fmt(start + scene.duration)}
            </p>
            <div className="button-row">
              <button
                onClick={() => act({ action: "timer", running: !live.running })}
              >
                {live.running ? <Pause /> : <Play />}
                {live.running ? "Pausar" : "Iniciar"}
              </button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "¿Reiniciar sólo el cronómetro? Los votos se conservan.",
                    )
                  )
                    act({ action: "timer", running: false, reset: true });
                }}
              >
                <RotateCcw />
                Reiniciar
              </button>
            </div>
          </div>
          <div className="panel">
            <p className="eyebrow">PRÓXIMA ESCENA</p>
            <h3>{next?.title || "Cierre"}</h3>
            <p>{next ? fmt(next.duration) : "Mantener QR visibles"}</p>
          </div>
          <div className="panel">
            <p className="eyebrow">VOTACIONES</p>
            <div className="vote-source-controls"><button onClick={()=>act({action:'input-source',value:'online',real:true})}>HTTPS</button><button onClick={()=>act({action:'input-source',value:'hands'})}>Manos levantadas</button></div>
            {live.rehearsal&&live.inputSource!=='hands'&&<div className="warning" role="status"><strong>ENSAYO: los celulares no pueden votar.</strong><p>Abrir una encuesta aquí sólo inicia la simulación local.</p>{live.voting?.connected&&<button onClick={()=>act({action:'input-source',value:'online',real:true})}>Usar votos reales en celulares</button>}</div>}
            <p>{live.inputSource==='hands'?'Contando en sala · fuente separada de los votos online':live.voting?.connected?'HTTPS conectado · sincronización en vivo':'HTTPS pendiente o sin conexión'}</p>
            {live.remoteCloseUnconfirmed&&<p className="warning">El servicio no confirmó el cierre online. No mezclar esos votos con las manos.</p>}
            <button
              className={live.rehearsal ? "rehearsal-tag" : "live-tag"}
              onClick={modeChange}
            >
              {live.rehearsal
                ? "ENSAYO · pasar a real"
                : "REAL · pasar a ensayo"}
            </button>
            {live.polls.map((poll) => (
              <div className="poll-control" key={poll.id}>
                <b>{poll.question}</b>
                <p>{poll.total} {poll.source==='hands'?'manos contadas':poll.source==='rehearsal'?'votos ficticios · sólo ensayo':'votos recibidos'}</p><p>{poll.source==='rehearsal'?(poll.open?'Abierta sólo en ensayo · celulares cerrados':'Ensayo local · celulares cerrados'):poll.source==='https'?(poll.open?'ABIERTA EN CELULARES':'CERRADA EN CELULARES'):''}</p>
                {live.inputSource==='hands'&&poll.options.map((option,i)=><label key={option}>{option}<input type="number" min="0" max="5000" value={live.handCounts?.[poll.id]?.[i]||0} onChange={e=>act({action:'hands-count',id:poll.id,choice:i,count:Number(e.target.value)})}/></label>)}
                <button
                  onClick={() =>
                    act({ action: "poll", id: poll.id, open: !poll.open })
                  }
                >
                  {poll.open ? "Cerrar" : "Abrir"}
                </button>
                <button
                  onClick={() =>
                    act({ action: "poll", id: poll.id, reveal: !poll.reveal })
                  }
                >
                  {poll.reveal ? "Ocultar" : "Revelar"}
                </button>
                {live.rehearsal && (
                  <div className="sample-buttons">
                    {poll.options.map((o, i) => (
                      <button
                        key={o}
                        onClick={() =>
                          act({ action: "sample-vote", id: poll.id, choice: i })
                        }
                      >
                        +1 ficticio · {o}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                act({ action: "reset-rehearsal" });
                setMsg(
                  "Ensayo restablecido a cero. No se tocaron votos reales.",
                );
              }}
            >
              Restablecer sólo ensayo
            </button>
          </div>
          <VotingSettings live={live}/>
          <div className="panel">
            <button
              onClick={() => {
                if (
                  !live.connection &&
                  !confirm(
                    "¿Verificaron una conexión confirmada en el sistema real?",
                  )
                )
                  return;
                act({ action: "connection", value: !live.connection });
              }}
            >
              {live.connection
                ? "Ocultar transición"
                : "Confirmar conexión observada"}
            </button>
            <small>La transición nunca cambia el MVP.</small>
          </div>
          {!live.timing.valid && (
            <p className="warning">
              Duración fuera del plan. Corregir en Studio antes de iniciar el
              reloj.
            </p>
          )}
          <p role="status" className="warning">
            {msg}
          </p>
          <details>
            <summary>Ir a una escena</summary>
            {scenes.map((s, i) => (
              <button
                className="scene-jump"
                key={s.id}
                onClick={() => act({ action: "scene", id: s.id })}
              >
                {i + 1}. {s.title}
              </button>
            ))}
          </details>
        </aside>
      </div>
    </main>
  );
}
export function App() {
  const { live, online, project } = useLive(),
    [admin, setAdmin] = useState<boolean | null>(null),
    [started, setStarted] = useState(false),
    [localScene, setLocalScene] = useState<string | null>(null);
  const path = location.pathname,
    privateRoute =
      path === "/presenter" || path === "/studio" || path === "/admin";
  useEffect(() => {
    if (privateRoute)
      api("/api/session")
        .then((v) => setAdmin(v.admin))
        .catch(() => setAdmin(false));
  }, [privateRoute]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "e") location.href = "/studio";
      if (e.altKey && e.key.toLowerCase() === "p") location.href = "/presenter";
      if (e.key.toLowerCase() === "f" && !privateRoute)
        document.documentElement.requestFullscreen?.().catch(() => {});
      if (
        !privateRoute &&
        path !== "/vote" &&
        !online &&
        ["ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        const list = project.scenes.filter((s) => !s.hidden),
          i = Math.max(
            0,
            list.findIndex((s) => s.id === (localScene || live?.sceneId)),
          );
        setLocalScene(
          list[
            Math.max(
              0,
              Math.min(list.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)),
            )
          ].id,
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [privateRoute, online, project, localScene, live]);
  useEffect(() => {
    for (const path of [
      "/brand/icon.svg",
      "/captures/home-desktop.png",
      "/captures/home-phone.png",
    ]) {
      const img = new Image();
      img.src = path;
    }
  }, []);
  if (path === "/vote")
    return <VotePage live={live} online={online} p={project} />;
  if (privateRoute) {
    if (admin === null)
      return <div className="loading">Comprobando acceso…</div>;
    if (!admin) return <Auth onSuccess={() => setAdmin(true)} />;
    if (path === "/studio") return <Studio live={live} />;
    if (!live) return <div className="loading">Conectando…</div>;
    return <Presenter live={live} online={online} p={project} />;
  }
  const scene =
    project.scenes.find(
      (s) => s.id === (online ? live?.sceneId : localScene || live?.sceneId),
    ) || project.scenes.find((s) => !s.hidden)!;
  return (
    <div className="projector">
      <AnimatePresence mode="wait">
        <Slide key={scene.id} scene={scene} p={project} live={live} />
      </AnimatePresence>
      {!started && (
        <div className="launch-overlay">
          <Brand />
          <p className="eyebrow">EL EXPERIMENTO / BUSCAG</p>
          <h1>
            Todo empieza
            <br />
            con una conexión.
          </h1>
          <button
            className="primary"
            onClick={() => {
              setStarted(true);
              window.dispatchEvent(new Event("buscag-start"));
              document.documentElement.requestFullscreen?.().catch(() => {});
            }}
          >
            Entrar en presentación <ArrowRight size={20} />
          </button>
          <label className="checkbox">
            <input
              type="checkbox"
              onChange={(e) => {
                (window as any).buscagAudio = e.target.checked;
              }}
            />
            Habilitar ambiente y sonidos
          </label>
          <small>
            F: pantalla completa · Alt+P: presentador · Alt+E: Studio
          </small>
        </div>
      )}
      {!online && (
        <div className="offline-tag">
          SIN CONEXIÓN · resultados no disponibles · flechas: avance local
        </div>
      )}
    </div>
  );
}

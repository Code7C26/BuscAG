import React, { useEffect, useState, useRef } from "react";
import {
  Plus,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Undo2,
  Redo2,
  Download,
  Upload,
  Eye,
  Settings2,
  Film,
  Palette,
  FileText,
  Radio,
  Link,
  RotateCcw,
  Lock,
  ArrowUpRight,
} from "lucide-react";
import { get, set } from "idb-keyval";
import {
  api,
  control,
  original,
  Project,
  Scene,
  Live,
  saveDraft,
  getDraft,
  exportProject,
  importProject,
  uploadAsset,
  fmt,
  download,
} from "./store";
import { Slide, QR } from "./main";
import { timing, validateProject, kinds } from "../server/model.mjs";
export function Studio({ live }: { live: Live | null }) {
  const [p, setP] = useState<Project>(original()),
    [selected, setSelected] = useState("scene-01"),
    [tab, setTab] = useState("scene"),
    [past, setPast] = useState<Project[]>([]),
    [future, setFuture] = useState<Project[]>([]),
    [msg, setMsg] = useState("Cargando proyecto…"),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [preview, setPreview] = useState(0),
    [dirty, setDirty] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    importer = useRef<HTMLInputElement>(null);
  const s = p.scenes.find((x) => x.id === selected) || p.scenes[0],
    index = p.scenes.indexOf(s),
    t = timing(p);
  useEffect(() => {
    api<Project>("/api/admin/project")
      .then(async (v) => {
        const previous = await getDraft();
        if (previous) await set("project-recovery", previous);
        setP(v);
        setSelected(v.scenes[0].id);
        setLoaded(true);
        setMsg("Proyecto del servidor cargado.");
      })
      .catch((e) => setMsg(e.message));
  }, []);
  useEffect(() => {
    if (loaded) {
      saveDraft(p).catch(() =>
        setMsg("No se pudo guardar el borrador en IndexedDB. Exportá un ZIP."),
      );
    }
  }, [p, loaded]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function edit(fn: (draft: Project) => void) {
    const d = structuredClone(p);
    fn(d);
    setPast((v) => [...v.slice(-39), p]);
    setFuture([]);
    setP(d);
    setDirty(true);
    setMsg("Borrador local · guardar para actualizar el proyector.");
  }
  function scenePatch(patch: Partial<Scene>) {
    edit((d) =>
      Object.assign(
        d.scenes.find((x) => x.id === s.id)!,
        patch,
      ),
    );
  }
  async function task(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    validateProject(p);
    await api("/api/admin/project", "PUT", p);
    setDirty(false);
    setMsg(
      "Guardado en servidor y IndexedDB. El proyector se actualiza en hasta 10 s.",
    );
  }
  function add(duplicate = false) {
    const id = "scene-" + crypto.randomUUID();
    edit((d) => {
      const fresh = structuredClone(duplicate ? s : original().scenes[4]);
      fresh.id = id;
      fresh.title = duplicate ? s.title + " (copia)" : "Nueva escena";
      fresh.duration = 60;
      fresh.kind = duplicate ? s.kind : "audience";
      d.scenes.splice(index + 1, 0, fresh);
    });
    setSelected(id);
  }
  function move(delta: number) {
    if (index + delta < 0 || index + delta >= p.scenes.length) return;
    edit((d) => {
      const [removed] = d.scenes.splice(index, 1);
      d.scenes.splice(index + delta, 0, removed);
    });
  }
  async function mediaUpload(f: File) {
    const allowed = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "video/mp4",
      "video/webm",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/mp4",
    ];
    if (!allowed.includes(f.type))
      throw Error(
        "Elegí PNG, JPG, WebP, MP4, WebM, MP3, WAV u OGG. SVG no se acepta como carga.",
      );
    if (f.size > 1024 ** 3) throw Error("Máximo 1 GB por recurso.");
    let seconds: number | undefined;
    if (f.type.startsWith("video/")) {
      seconds = await new Promise<number>((resolve, reject) => {
        const v = document.createElement("video"),
          url = URL.createObjectURL(f);
        v.preload = "metadata";
        v.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          resolve(v.duration);
        };
        v.onerror = () => {
          URL.revokeObjectURL(url);
          reject(Error("El navegador no reconoce este video."));
        };
        v.src = url;
      });
      if (s.kind === "video" && Math.abs(seconds - 60) > 0.25)
        throw Error(
          `El video inglés debe durar 60 s. Archivo: ${seconds.toFixed(2)} s. No se recorta ni modifica.`,
        );
    }
    const id = "asset-" + crypto.randomUUID();
    await uploadAsset(id, f);
    edit((d) => {
      d.assets.push({
        id,
        name: f.name,
        type: f.type,
        size: f.size,
        seconds,
      } as never);
      const target = d.scenes.find((x) => x.id === s.id)!;
      if (f.type.startsWith("audio/")) target.sound = id;
      else target.media = id;
    });
    setMsg("Recurso cargado y almacenado. Guardá el proyecto para vincularlo.");
  }
  function normalize() {
    const video = p.scenes.filter((s) => !s.hidden && s.kind === "video");
    if (video.length !== 1) {
      setMsg("Debe quedar exactamente una escena de video visible.");
      return;
    }
    const vi = p.scenes.indexOf(video[0]),
      before = p.scenes.slice(0, vi).filter((s) => !s.hidden),
      after = p.scenes.slice(vi + 1).filter((s) => !s.hidden);
    if (after.length > 48) {
      setMsg(
        "Demasiadas escenas después del video: cada una necesita al menos 5 s.",
      );
      return;
    }
    if (!before.length || !after.length) {
      setMsg("El video necesita escenas antes y después.");
      return;
    }
    edit((d) => {
      for (const [list, total] of [
        [before, 1500],
        [after, 240],
      ] as const) {
        const sum = list.reduce((v, s) => v + s.duration, 0);
        let remaining = total;
        list.forEach((s, i) => {
          const dur =
            i === list.length - 1
              ? remaining
              : Math.max(5, Math.round((s.duration / sum) * total));
          d.scenes.find((x) => x.id === s.id)!.duration = dur;
          remaining -= dur;
        });
      }
      d.scenes.find((s) => s.id === video[0].id)!.duration = 60;
    });
  }
  function undo() {
    if (!past.length) return;
    setFuture((v) => [p, ...v]);
    setP(past[past.length - 1]);
    setPast((v) => v.slice(0, -1));
    setDirty(true);
  }
  function redo() {
    if (!future.length) return;
    setPast((v) => [...v, p]);
    setP(future[0]);
    setFuture((v) => v.slice(1));
    setDirty(true);
  }
  const input = (label: string, key: keyof Scene, area = false) => (
    <label>
      {label}
      {area ? (
        <textarea
          value={String(s[key])}
          onChange={(e) => scenePatch({ [key]: e.target.value })}
          rows={key === "script" ? 10 : 3}
        />
      ) : (
        <input
          value={String(s[key])}
          onChange={(e) => scenePatch({ [key]: e.target.value })}
        />
      )}
    </label>
  );
  if (!loaded) return <main className="loading"><p role="status">{msg}</p></main>;
  return (
    <main className="studio">
      <header className="studio-header">
        <div className="studio-logo">
          <img src="/brand/icon.svg" alt="BuscAG" />
          <div>
            <b>
              BuscAG <span>Studio</span>
            </b>
            <small>EL EXPERIMENTO / EDICIÓN PRIVADA</small>
          </div>
        </div>
        <div className="button-row">
          <button
            title="Deshacer"
            disabled={!past.length || busy}
            onClick={undo}
          >
            <Undo2 />
          </button>
          <button
            title="Rehacer"
            disabled={!future.length || busy}
            onClick={redo}
          >
            <Redo2 />
          </button>
          <button
            onClick={() =>
              task(async () => {
                await exportProject(p);
                setMsg(
                  "ZIP completo exportado. Incluye multimedia y guion; conservarlo privado.",
                );
              })
            }
            disabled={busy}
          >
            <Download />
            Exportar ZIP
          </button>
          <button onClick={() => importer.current?.click()} disabled={busy}>
            <Upload />
            Importar
          </button>
          <button
            className="primary"
            onClick={() => task(save)}
            disabled={busy || !loaded}
          >
            <Save />
            {busy ? "Procesando…" : "Guardar"}
          </button>
          <a href="/presenter">
            Presentador <ArrowUpRight size={16} />
          </a>
        </div>
        <input
          ref={importer}
          hidden
          type="file"
          accept=".zip"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (
              f &&
              confirm(
                "¿Importar el proyecto? Se conserva deshacer y no se borran votos reales.",
              )
            )
              task(async () => {
                const next = await importProject(f);
                setPast((v) => [...v, p]);
                setP(next);
                setSelected(next.scenes[0].id);
                setDirty(true);
                setMsg(
                  "Importado con recursos. Revisá y guardá para publicar al proyector.",
                );
              });
            e.target.value = "";
          }}
        />
      </header>
      <div className="studio-grid">
        <aside className="scene-list">
          <div className="scene-list-heading">
            <span>ESCENAS / {p.scenes.length}</span>
            <button aria-label="Agregar escena" onClick={() => add()}>
              <Plus size={18} />
            </button>
          </div>
          {p.scenes.map((sc, i) => (
            <button
              className={
                "scene-item " +
                (sc.id === s.id ? "selected" : "") +
                (sc.hidden ? " hidden-scene" : "")
              }
              key={sc.id}
              onClick={() => setSelected(sc.id)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <b>{sc.title}</b>
                <small>
                  {fmt(sc.duration)} · {sc.hidden ? "oculta" : sc.kind}
                </small>
              </div>
              {sc.hidden && <Eye size={14} />}
            </button>
          ))}
          <div className={"timing-summary " + (!t.valid ? "warning" : "")}>
            <ClockIcon /> {fmt(t.total)} / 30:00
            <p>
              Video:{" "}
              {t.video
                ? fmt(t.video.start) +
                  "–" +
                  fmt(t.video.start + t.video.duration)
                : "pendiente"}
            </p>
            <button onClick={normalize}>Ajustar a 30:00 y video 25–26</button>
          </div>
        </aside>
        <div className="studio-center">
          <div className="preview-toolbar">
            <span>VISTA PREVIA / 16:9</span>
            <button onClick={() => setPreview((v) => v + 1)}>
              <PlayIcon />
              Repetir animación
            </button>
            <button
              onClick={() =>
                task(async () => {
                  await save();
                  await control({ action: "scene", id: s.id });
                  setMsg("Escena enviada al proyector.");
                })
              }
              disabled={s.hidden || busy}
            >
              Mostrar en proyector
            </button>
          </div>
          <div className="preview-frame" key={preview}>
            <Slide scene={s} p={p} live={live} preview />
          </div>
          <div className="scene-actions">
            <button onClick={() => add(true)}>
              <Copy />
              Duplicar
            </button>
            <button onClick={() => move(-1)} disabled={!index}>
              <ArrowUp />
              Subir
            </button>
            <button
              onClick={() => move(1)}
              disabled={index === p.scenes.length - 1}
            >
              <ArrowDown />
              Bajar
            </button>
            <button onClick={() => scenePatch({ hidden: !s.hidden })}>
              <Eye />
              {s.hidden ? "Mostrar" : "Ocultar"}
            </button>
            <button
              className="danger"
              disabled={p.scenes.length === 1}
              onClick={() => {
                if (confirm("¿Eliminar esta escena? Podés deshacer."))
                  edit((d) => {
                    d.scenes = d.scenes.filter((x) => x.id !== s.id);
                  });
              }}
            >
              <Trash2 />
              Eliminar
            </button>
          </div>
          <div className="studio-status" role="status">
            <span className={dirty ? "dirty-dot" : "saved-dot"} />
            {msg}
          </div>
          <div className="panel">
            <h3>Respaldo y recuperación</h3>
            <p>
              Los borradores y recursos grandes se conservan en IndexedDB.
              Guardar confirma el proyecto en este servidor; exportar ZIP
              permite trasladarlo a otra PC.
            </p>
            <div className="button-row">
              <button
                onClick={() =>
                  task(async () => {
                    const draft =
                      (await get<Project>("project-recovery")) ||
                      (await getDraft());
                    if (!draft) throw Error("No hay borrador local.");
                    edit((d) => Object.assign(d, draft));
                    setMsg("Borrador local restaurado.");
                  })
                }
              >
                Restaurar borrador local
              </button>
              <button
                onClick={() =>
                  task(async () => {
                    const b = await get<Project>("studio-backup");
                    if (!b) throw Error("Primero crear un respaldo local.");
                    edit((d) => Object.assign(d, b));
                    setMsg("Respaldo local restaurado.");
                  })
                }
              >
                Restaurar respaldo
              </button>
              <button
                onClick={() =>
                  task(async () => {
                    await set("studio-backup", p);
                    setMsg(
                      "Respaldo de proyecto creado en IndexedDB. Los medios se retienen en el almacén.",
                    );
                  })
                }
              >
                Crear respaldo local
              </button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "¿Restaurar el diseño original? Conserva deshacer; las encuestas con votos reales no se redefinen.",
                    )
                  ) {
                    task(async () => {
                      const seed = await api<Project>("/api/admin/original");
                      edit((d) => Object.assign(d, seed));
                      setSelected("scene-01");
                    });
                  }
                }}
              >
                <RotateCcw />
                Restaurar original
              </button>
            </div>
          </div>
        </div>
        <aside className="inspector">
          <nav className="inspector-tabs">
            {[
              ["scene", Settings2, "Escena"],
              ["script", FileText, "Guion"],
              ["media", Film, "Medios"],
              ["design", Palette, "Diseño"],
              ["polls", Radio, "Encuestas"],
              ["links", Link, "Enlaces"],
            ].map(([id, Icon, label]) => {
              const I = Icon as React.ElementType;
              return (
                <button
                  key={id as string}
                  className={tab === id ? "active" : ""}
                  onClick={() => setTab(id as string)}
                  title={label as string}
                >
                  <I size={18} />
                  <span>{label as string}</span>
                </button>
              );
            })}
          </nav>
          <div className="inspector-fields">
            {tab === "scene" && (
              <>
                <p className="eyebrow">ESCENA {index + 1}</p>
                {input("Antetítulo", "kicker")}
                {input("Título", "title", true)}
                {input("Bajada", "subtitle", true)}
                <label>
                  Tipo de escena
                  <select
                    value={s.kind}
                    onChange={(e) => scenePatch({ kind: e.target.value })}
                  >
                    {kinds.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Duración (segundos)
                  <input
                    type="number"
                    min="5"
                    max="600"
                    value={s.duration}
                    onChange={(e) =>
                      scenePatch({ duration: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Puntos (uno por línea)
                  <textarea
                    rows={6}
                    value={s.bullets.join("\n")}
                    onChange={(e) =>
                      scenePatch({ bullets: e.target.value.split("\n") })
                    }
                  />
                </label>
                <label>
                  Composición
                  <select
                    value={s.layout}
                    onChange={(e) => scenePatch({ layout: e.target.value })}
                  >
                    <option value="split">Dos columnas</option>
                    <option value="center">Centrada</option>
                    <option value="wide">Visual protagonista</option>
                  </select>
                </label>
                <p className="muted">
                  Cambiar el tipo conserva los textos. La escena poll usa
                  encuesta 1 en scene-03 y encuesta 2 en las demás.
                </p>
              </>
            )}
            {tab === "script" && (
              <>
                {input("Quién habla", "speaker")}
                {input("Discurso completo", "script", true)}
                {input("Pausas, acciones y transiciones", "actions", true)}
                <button
                  onClick={() => {
                    download(
                      new Blob(
                        [
                          p.scenes
                            .map(
                              (sc) =>
                                "## " +
                                sc.title +
                                " — " +
                                sc.speaker +
                                "\n" +
                                sc.script +
                                "\nAcciones: " +
                                sc.actions,
                            )
                            .join("\n\n"),
                        ],
                        { type: "text/markdown" },
                      ),
                      "SCRIPT-editado.md",
                    );
                  }}
                >
                  Exportar guion editado
                </button>
              </>
            )}
            {tab === "media" && (
              <>
                <h3>Recursos de esta escena</h3>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => file.current?.click()}
                >
                  <Upload />
                  Cargar / reemplazar
                </button>
                <input
                  ref={file}
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) task(() => mediaUpload(f));
                    e.target.value = "";
                  }}
                />
                <p>
                  PNG, JPG, WebP, MP4, WebM, MP3, WAV, OGG. Hasta 1 GB por
                  archivo. Video inglés: original de 60 s; no se recorta.
                </p>
                <label>
                  Imagen / video
                  <select
                    value={s.media}
                    onChange={(e) => scenePatch({ media: e.target.value })}
                  >
                    <option value="">Sin recurso · visual original</option>
                    {p.assets
                      .filter((a) => !a.type.startsWith("audio/"))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Sonido
                  <select
                    value={s.sound}
                    onChange={(e) => scenePatch({ sound: e.target.value })}
                  >
                    <option value="">Sin sonido</option>
                    <option value="builtin-connection">
                      Ambiente original de conexión (CC0)
                    </option>
                    {p.assets
                      .filter((a) => a.type.startsWith("audio/"))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </label>
                {s.sound && (
                  <audio
                    src={
                      s.sound === "builtin-connection"
                        ? "/sounds/connection.wav"
                        : "/media/" + s.sound
                    }
                    controls
                    preload="metadata"
                  />
                )}
                <button onClick={() => scenePatch({ media: "", sound: "" })}>
                  Quitar de esta escena
                </button>
                <p className="warning">
                  El MP4 debe ser el video original en inglés de ambos. Las
                  capturas incluidas usan backend sintético y no reemplazan
                  evidencia de la demo.
                </p>
                <h3>Identidad</h3>
                <p>
                  Para reemplazar el logo global, cargar una imagen y elegirla
                  aquí.
                </p>
                <label>
                  Logo
                  <select
                    value={(p as any).logo || ""}
                    onChange={(e) =>
                      edit((d) => {
                        (d as any).logo = e.target.value;
                      })
                    }
                  >
                    <option value="">Símbolo original del repo</option>
                    {p.assets
                      .filter((a) => a.type.startsWith("image/"))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
            {tab === "design" && (
              <>
                <h3>Diseño y movimiento</h3>
                <label>
                  Color de fondo
                  <input
                    type="color"
                    value={s.background}
                    onChange={(e) => scenePatch({ background: e.target.value })}
                  />
                </label>
                <label>
                  Acento global
                  <input
                    type="color"
                    value={p.theme.accent}
                    onChange={(e) =>
                      edit((d) => {
                        d.theme.accent = e.target.value;
                      })
                    }
                  />
                </label>
                <label>
                  Texto global
                  <input
                    type="color"
                    value={p.theme.text}
                    onChange={(e) =>
                      edit((d) => {
                        d.theme.text = e.target.value;
                      })
                    }
                  />
                </label>
                <label>
                  Fuente
                  <select
                    value={p.theme.font}
                    onChange={(e) =>
                      edit((d) => {
                        d.theme.font = e.target.value;
                      })
                    }
                  >
                    <option>Manrope</option>
                    <option>system-ui</option>
                    <option>Georgia</option>
                  </select>
                </label>
                {[
                  ["fontSize", "Escala tipográfica", 0.6, 1.5, 0.05],
                  ["x", "Posición horizontal (%)", -20, 20, 1],
                  ["y", "Posición vertical (%)", -20, 20, 1],
                  ["speed", "Velocidad de entrada", 0.3, 3, 0.1],
                ].map(([key, label, min, max, step]) => (
                  <label key={key as string}>
                    {label} · {s[key as keyof Scene] as number}
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={s[key as keyof Scene] as number}
                      onChange={(e) =>
                        scenePatch({ [key]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
                <label>
                  Preset de animación
                  <select
                    value={s.animation}
                    onChange={(e) => scenePatch({ animation: e.target.value })}
                  >
                    <option value="cinematic">Zoom cinematográfico</option>
                    <option value="fade">Fundido</option>
                    <option value="rise">Entrada vertical</option>
                    <option value="none">Sin animación</option>
                  </select>
                </label>
                <p>
                  Duración de entrada: {(0.65 / s.speed).toFixed(2)} s. Los
                  efectos se limitan a opacidad y transformaciones.
                </p>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={p.reducedMotion}
                    onChange={(e) =>
                      edit((d) => {
                        d.reducedMotion = e.target.checked;
                      })
                    }
                  />
                  Reducir movimiento global
                </label>
              </>
            )}
            {tab === "polls" && (
              <>
                <h3>Encuestas integradas</h3>
                <label>
                  Encuesta de esta escena
                  <select
                    value={
                      (s as any).pollId ||
                      (s.id === "scene-03" ? "search" : "object")
                    }
                    onChange={(e) =>
                      scenePatch({ pollId: e.target.value } as any)
                    }
                  >
                    <option value="search">1 · Dónde buscarías</option>
                    <option value="object">2 · Objeto de la demo</option>
                  </select>
                </label>
                {p.polls.map((poll, i) => (
                  <div className="poll-edit" key={poll.id}>
                    <label>
                      Pregunta {i + 1}
                      <input
                        value={poll.question}
                        onChange={(e) =>
                          edit((d) => {
                            d.polls[i].question = e.target.value;
                          })
                        }
                      />
                    </label>
                    <label>
                      Opciones (una por línea)
                      <textarea
                        value={poll.options.join("\n")}
                        onChange={(e) =>
                          edit((d) => {
                            d.polls[i].options = e.target.value.split("\n");
                          })
                        }
                      />
                    </label>
                    <QR
                      value={
                        (p.links.voteOrigin || location.origin) +
                        "/vote?poll=" +
                        poll.id
                      }
                      label="Participación móvil"
                    />
                    <div className="button-row">
                      <button
                        disabled={busy}
                        onClick={() =>
                          task(async () => {
                            await control({
                              action: "poll",
                              id: poll.id,
                              open: !live?.polls[i]?.open,
                            });
                            setMsg("Estado de encuesta actualizado.");
                          })
                        }
                      >
                        {live?.polls[i]?.open ? "Cerrar" : "Abrir"}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          task(async () => {
                            await control({
                              action: "poll",
                              id: poll.id,
                              reveal: !live?.polls[i]?.reveal,
                            });
                            setMsg("Visibilidad actualizada.");
                          })
                        }
                      >
                        {live?.polls[i]?.reveal ? "Ocultar" : "Revelar"}
                      </button>
                    </div>
                  </div>
                ))}
                <p>
                  No se pueden redefinir preguntas u opciones después de recibir
                  votos reales. Los votos no están en el ZIP y no se borran
                  desde Studio.
                </p>
                <label>
                  Origen público o LAN para QR
                  <input
                    placeholder="https://presentacion.example o http://192.168.x.x:4173"
                    value={p.links.voteOrigin}
                    onChange={(e) =>
                      edit((d) => {
                        d.links.voteOrigin = e.target.value.replace(/\/$/, "");
                      })
                    }
                  />
                </label>
                <p>
                  Servidor de votos propio por HTTP/SSE + SQLite, independiente
                  de BuscAG. Todos los teléfonos deben acceder al mismo origen.
                  No requiere claves Supabase.
                </p>
                <button
                  onClick={() => {
                    task(async () => {
                      await control({ action: "reset-rehearsal" });
                      setMsg(
                        "Datos de ensayo restablecidos. Los votos reales se conservan.",
                      );
                    });
                  }}
                >
                  Reiniciar sólo ensayo
                </button>
              </>
            )}
            {tab === "links" && (
              <>
                <h3>Enlaces y QR</h3>
                {Object.entries(p.links).map(([key, value]) => (
                  <label key={key}>
                    {key}
                    <input
                      value={value}
                      placeholder="Pendiente"
                      onChange={(e) =>
                        edit((d) => {
                          (d.links as Record<string, string>)[key] =
                            e.target.value;
                        })
                      }
                    />
                  </label>
                ))}
                <QR value={p.links.web} label="Web de prueba" />
                <QR value={p.links.github} label="Repositorio" />
                <p>
                  Confirmar destinos antes de imprimir. Los enlaces vacíos
                  permanecen pendientes; no se inventan redes ni contactos.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
function ClockIcon() {
  return <span>◷</span>;
}
function PlayIcon() {
  return <span>▷</span>;
}

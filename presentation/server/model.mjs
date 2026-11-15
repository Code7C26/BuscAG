export const kinds = [
  "signal",
  "team",
  "poll",
  "scatter",
  "audience",
  "reveal",
  "demo",
  "architecture",
  "code",
  "challenge",
  "testing",
  "value",
  "costs",
  "viability",
  "management",
  "video",
  "marketing",
  "vision",
  "invite",
  "closing",
];
export function validateProject(p) {
  if (
    !p ||
    p.version !== 1 ||
    !Array.isArray(p.scenes) ||
    p.scenes.length < 1 ||
    p.scenes.length > 80
  )
    throw Error("Proyecto inválido (versión o escenas).");
  const ids = new Set();
  for (const s of p.scenes) {
    if (!/^[-\w]{1,80}$/.test(s.id) || ids.has(s.id))
      throw Error("Identificador de escena inválido o repetido.");
    ids.add(s.id);
    if (
      !kinds.includes(s.kind) ||
      !Number.isFinite(s.duration) ||
      s.duration < 5 ||
      s.duration > 600
    )
      throw Error("Tipo o duración inválidos.");
    for (const key of [
      "title",
      "subtitle",
      "kicker",
      "script",
      "speaker",
      "actions",
      "media",
      "sound",
    ])
      if (typeof s[key] !== "string" || s[key].length > 20000)
        throw Error("Texto de escena inválido.");
    if (
      !Array.isArray(s.bullets) ||
      s.bullets.length > 10 ||
      s.bullets.some((b) => typeof b !== "string" || b.length > 1000)
    )
      throw Error("Viñetas inválidas.");
    if (
      !/^#[a-f0-9]{6}$/i.test(s.background) ||
      !["split", "center", "wide"].includes(s.layout) ||
      !["cinematic", "fade", "rise", "none"].includes(s.animation)
    )
      throw Error("Diseño inválido.");
    for (const [key, min, max] of [
      ["fontSize", 0.6, 1.5],
      ["speed", 0.3, 3],
      ["x", -20, 20],
      ["y", -20, 20],
    ])
      if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max)
        throw Error("Control de diseño fuera de rango.");
  }
  if (p.logo && !/^[-\w]{1,100}$/.test(p.logo)) throw Error("Logo inválido.");
  for (const s of p.scenes) {
    if (s.pollId && !["search", "object"].includes(s.pollId))
      throw Error("Encuesta de escena inválida.");
  }
  if (!p.scenes.some((s) => !s.hidden))
    throw Error("Debe quedar una escena visible.");
  if (
    !p.theme ||
    !/^#[a-f0-9]{6}$/i.test(p.theme.accent) ||
    !/^#[a-f0-9]{6}$/i.test(p.theme.text) ||
    !["Manrope", "system-ui", "Georgia"].includes(p.theme.font)
  )
    throw Error("Tema inválido.");
  if (!Array.isArray(p.polls) || p.polls.length !== 2)
    throw Error("Se requieren las dos encuestas.");
  p.polls.forEach((poll, i) => {
    if (
      poll.id !== ["search", "object"][i] ||
      typeof poll.question !== "string" ||
      poll.question.length > 250 ||
      !Array.isArray(poll.options) ||
      poll.options.length < 2 ||
      poll.options.length > 6 ||
      new Set(poll.options).size !== poll.options.length ||
      poll.options.some(
        (o) => typeof o !== "string" || !o.trim() || o.length > 100,
      )
    )
      throw Error("Encuesta inválida.");
  });
  if (
    !p.links ||
    Object.values(p.links).some(
      (v) =>
        typeof v !== "string" ||
        v.length > 2000 ||
        (v !== "" && !/^https?:\/\//.test(v) && !/^\/docs\/[\w.-]+$/.test(v)),
    )
  )
    throw Error("Sólo enlaces HTTP(S) o documentos locales.");
  if (!Array.isArray(p.assets) || p.assets.length > 200)
    throw Error("Recursos inválidos.");
  p.assets.forEach((a) => {
    if (
      !/^[-\w]{1,100}$/.test(a.id) ||
      typeof a.name !== "string" ||
      ![
        "image/png",
        "image/jpeg",
        "image/webp",
        "video/mp4",
        "video/webm",
        "audio/mpeg",
        "audio/wav",
        "audio/ogg",
        "audio/mp4",
      ].includes(a.type)
    )
      throw Error("Recurso no admitido.");
  });
  return p;
}
export const publicProject = (p) => ({
  ...p,
  scenes: p.scenes.map(({ script, actions, ...rest }) => rest),
});
const titles=['El experimento','El público decide','La sorpresa principal','Lo que el público no ve','¿Y si esto fuera más grande?','El final inesperado'];
const makeActs=edges=>titles.map((title,i)=>({id:i+1,title,start:edges[i],end:edges[i+1]}));
export const acts=makeActs([0,150,360,840,1080,1380,1500]);
const legacyActs=makeActs([0,240,480,900,1200,1620,1800]);
export function schedule(p){return p.narrativeVersion===2?{target:1800,videoStart:1500,acts:legacyActs}:{target:1500,videoStart:1290,acts};}
export function actsValid(p){if(![2,3].includes(p.narrativeVersion))return false;let clock=0;for(const act of schedule(p).acts){const list=p.scenes.filter(s=>!s.hidden&&s.act===act.id);if(!list.length||clock!==act.start)return false;clock+=list.reduce((a,s)=>a+s.duration,0);if(clock!==act.end)return false;}return p.scenes.filter(s=>!s.hidden).every((s,i,list)=>!i||s.act>=list[i-1].act);}
export function timing(p) {
  let t = 0,
    video = null;
  for (const s of p.scenes.filter((s) => !s.hidden)) {
    if (s.kind === "video") video = { start: t, duration: s.duration };
    t += s.duration;
  }
  return {
    total: t,
    video,
    valid:
      t === schedule(p).target &&
      actsValid(p) &&
      video?.start === schedule(p).videoStart &&
      video?.duration === 60 &&
      p.scenes.filter((s) => !s.hidden && s.kind === "video").length === 1,
  };
}

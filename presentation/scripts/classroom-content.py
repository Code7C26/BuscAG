"""Generate screen copy, private script and timing from a single audited 25-minute plan."""
import json,re,pathlib
base=pathlib.Path(__file__).resolve().parents[1]
plan=json.loads((base/'docs/content-25.json').read_text())
p=json.loads((base/'docs/archive/30-minutos/project.json').read_text())
fmt=lambda t:f'{t//60:02}:{t%60:02}'
p['narrativeVersion']=3
script=['# BUSCAG — EL EXPERIMENTO · Guion coordinado de 25 minutos','', '24 diapositivas · seis actos · 25:00 nominales, incluidas encuestas, operación de la demo y video. Video inglés original: 21:30–22:30. Valentino y Germán disponen de 12:00 cada uno, más el minuto compartido del video. Avance manual; ensayar con cronómetro. Los tiempos son presupuestos de intervención, no una velocidad oral garantizada.','', 'Las capturas de apoyo conservan el rótulo de datos sintéticos. La demostración se hace con dos cuentas en el MVP, sin repetir aparte todo el bloque 08–11. Las condiciones del backend están en las notas de cada escena, no deben leerse como un discurso adicional.','']
story=['# Las 24 diapositivas · plan de 25 minutos','', '| N.º | Acto | Inicio–fin | Quién | Pantalla | Avance |','|---|---|---|---|---|---|']
audit=[];clock=0;by_speaker={'Valentino':0,'Germán':0};words={'Valentino':0,'Germán':0}
for scene,item in zip(p['scenes'],plan['scenes'],strict=True):
 duration=sum(x['seconds'] for x in item['interventions'])
 scene.update(title=item['title'],subtitle=item['subtitle'],bullets=item['bullets'],duration=duration)
 names=list(dict.fromkeys(x['speaker'] for x in item['interventions']))
 scene['speaker']=' + '.join(names) if names!=['Video'] else 'Ambos · video original'
 chunks=[];position=clock
 script += [f"## Diapositiva {item['number']:02} · Acto {scene['act']} · {fmt(clock)}–{fmt(clock+duration)}",f"**En pantalla:** {scene['title']} — {scene['subtitle']}", '**Puntos visibles:** '+' · '.join(scene['bullets']) if scene['bullets'] else '**Visual:** conservar la escena cinematográfica original.','']
 for part in item['interventions']:
  who=part['speaker'];secs=part['seconds'];count=len(re.findall(r"\b[\wÁÉÍÓÚÜÑáéíóúüñ]+\b",part['text']))
  if who in by_speaker:by_speaker[who]+=secs;words[who]+=count
  text=part['text'] or '[VIDEO: reproducir el original en inglés completo, sin hablar encima.]'
  chunks += [f"{who.upper()} · {fmt(position)}–{fmt(position+secs)}\n{text}\n[OPERACIÓN / AVANCE] {part['cue']}"]
  script += [f"### {who.upper()} · {fmt(position)}–{fmt(position+secs)}",text,'',f"**Operación y avance:** {part['cue']}",'']
  audit.append({'slide':item['number'],'speaker':who,'start':position,'end':position+secs,'seconds':secs,'words':count,'speechSecondsAt130wpm':round(count*60/130,1),'availableForActions':round(secs-count*60/130,1)})
  position+=secs
 scene['script']='\n\n'.join(chunks)
 scene['actions']=' '.join(x['cue'] for x in item['interventions'])+' Nota privada: '+item['notes']
 script += ['**Nota privada de preparación:** '+item['notes'],'']
 story += [f"| {item['number']:02} | {scene['act']} | {fmt(clock)}–{fmt(clock+duration)} | {scene['speaker']} | {scene['title']} | {item['interventions'][-1]['cue']} |"]
 clock+=duration
assert clock==1500 and len(p['scenes'])==24 and by_speaker=={'Valentino':720,'Germán':720}
pub=json.loads(json.dumps(p))
for scene in pub['scenes']:scene['script']='';scene['actions']=''
for name,data in [('src/seed.json',p),('src/public-seed.json',pub)]: (base/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(base/'SCRIPT.md').write_text('\n'.join(script).rstrip()+'\n');(base/'STORYBOARD.md').write_text('\n'.join(story)+'\n')
report={'totalSeconds':clock,'video':{'start':1290,'duration':60},'allocatedBySpeaker':by_speaker,'wordsBySpeaker':words,'segments':audit}
(base/'docs/TIMING-25.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'total':clock,'secondsBySpeaker':by_speaker,'wordsBySpeaker':words},ensure_ascii=False))
for a in audit:
 if a['speaker']!='Video' and a['availableForActions']<8:print('REVISAR RITMO',a)

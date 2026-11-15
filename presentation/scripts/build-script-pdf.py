"""Rebuild the printable private script from docs/content-25.json (requires reportlab)."""
import json,pathlib,re
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,KeepTogether
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
r=pathlib.Path(__file__).resolve().parents[1]
p=json.loads((r/'docs/content-25.json').read_text());seed=json.loads((r/'src/seed.json').read_text());timing=json.loads((r/'docs/TIMING-25.json').read_text())
fonts=pathlib.Path('/usr/share/fonts/truetype/dejavu')
for name,file in [('BuscAG','DejaVuSans.ttf'),('BuscAG-Bold','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,str(fonts/file)))
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleAG',fontName='BuscAG-Bold',fontSize=23,leading=29,textColor=colors.HexColor('#061327'),spaceAfter=16))
styles.add(ParagraphStyle(name='SceneAG',fontName='BuscAG-Bold',fontSize=15,leading=20,textColor=colors.HexColor('#123c59'),spaceAfter=8))
styles.add(ParagraphStyle(name='SpeakerAG',fontName='BuscAG-Bold',fontSize=11,leading=15,textColor=colors.HexColor('#126079'),spaceBefore=9,spaceAfter=6))
styles.add(ParagraphStyle(name='SpokenAG',fontName='BuscAG',fontSize=11.5,leading=17,spaceAfter=8))
styles.add(ParagraphStyle(name='CueAG',fontName='BuscAG-Bold',fontSize=9,leading=13,textColor=colors.HexColor('#174c65'),backColor=colors.HexColor('#edf5f8'),borderPadding=7,spaceBefore=3,spaceAfter=10))
styles.add(ParagraphStyle(name='NoteAG',fontName='BuscAG',fontSize=9,leading=13,textColor=colors.HexColor('#516273'),spaceAfter=9))
styles.add(ParagraphStyle(name='CellAG',fontName='BuscAG',fontSize=8.2,leading=11))
fmt=lambda s:f'{s//60:02}:{s%60:02}'
P=lambda t,style='SpokenAG':Paragraph(escape(t).replace('\n','<br/>'),styles[style])
output=r/'docs/Guion_BuscAG_Valentino_German_25min.pdf'
doc=SimpleDocTemplate(str(output),pagesize=A4,rightMargin=43,leftMargin=43,topMargin=40,bottomMargin=42,title='BuscAG — El Experimento · Guion de Valentino y Germán · 25 minutos',author='Valentino Mamonde y Germán Luján',subject='Guion privado coordinado con las 24 diapositivas. Revisión funcional, 25:00 nominales.')
flow=[P('BUSCAG — EL EXPERIMENTO','TitleAG'),P('Guion completo de Valentino y Germán · 24 diapositivas · 25:00 nominales','SceneAG'),P('Incluye participación del público, dos encuestas, demo con dos cuentas y un minuto del video original en inglés. Las duraciones incluyen hablar, operar y esperar; el ensayo con cronómetro determina el ritmo real.'),P('Reparto: Valentino 12:00 y Germán 12:00 de intervención, más 1:00 de video compartido. Texto oral: '+str(timing['wordsBySpeaker']['Valentino'])+' palabras de Valentino y '+str(timing['wordsBySpeaker']['Germán'])+' de Germán. Se conservan las animaciones y los seis actos.','NoteAG'),P('Uso: el texto grande se dice en voz alta. Las cajas azules indican qué hacer y cuándo avanzar. Las notas grises son de preparación; no se leen al público. En 08–11, mantener el MVP en la tele y avanzar las escenas de apoyo desde el presentador. Volver a las diapositivas en 12, al 14:00.','CueAG')]
rows=[[P('N.º','CellAG'),P('Inicio–fin','CellAG'),P('Contenido','CellAG'),P('Interviene','CellAG')]];at=0
for s,item in zip(seed['scenes'],p['scenes']):
 rows.append([P(f"{item['number']:02}",'CellAG'),P(fmt(at)+'–'+fmt(at+s['duration']),'CellAG'),P(s['title'],'CellAG'),P(s['speaker'],'CellAG')]);at+=s['duration']
table=Table(rows,colWidths=[27,80,261,99],repeatRows=1,hAlign='LEFT');table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#dfedf4')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f6f8fa')]),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)]));flow.extend([table,PageBreak()]);at=0
for s,item in zip(seed['scenes'],p['scenes']):
 block=[P(f"Diapositiva {item['number']:02} · Acto {s['act']} · {fmt(at)}–{fmt(at+s['duration'])}",'SceneAG'),P(s['title'],'SpeakerAG'),P('EN PANTALLA: '+s['subtitle']+' '+(' · '.join(s['bullets'])),'NoteAG')];pos=at
 for part in item['interventions']:
  block.extend([P(part['speaker'].upper()+' · '+fmt(pos)+'–'+fmt(pos+part['seconds']),'SpeakerAG'),P(part['text'] or '[Reproducir el video original en inglés completo. Ambos guardan silencio.]'),P('OPERACIÓN / AVANCE: '+part['cue'],'CueAG')]);pos+=part['seconds']
 block.extend([P('PREPARACIÓN: '+item['notes'],'NoteAG'),Spacer(1,14)]);flow.append(KeepTogether(block));at+=s['duration']
flow.extend([PageBreak(),P('Comprobaciones antes de exponer','SceneAG'),P('1. Usar la plantilla de 25 minutos, con 24 escenas y el reloj en cero. Las copias anteriores de 30 minutos no se sobrescriben automáticamente.'),P('2. Probar ambos QR de votación, elegir REAL/HTTPS y distinguirlos de ENSAYO. Si falla internet, seleccionar manos levantadas y no mezclar conteos.'),P('3. Preparar tres objetos y dos perfiles de navegador con cuentas diferentes. Ensayar publicación, edición, filtros, mapa, coincidencia, mensaje, aviso y recuperación habilitada. No modificar datos ajenos ni desplegar SQL para la exposición.'),P('4. Cargar el video original de 60 segundos; empieza al 21:30 y termina al 22:30. Si todavía falta, declararlo pendiente; este guion no lo reemplaza.'),P('5. Comprobar tele por HDMI en modo Extender: presentación pública en la tele y presentador privado en la notebook. Ensayar el regreso del MVP a la diapositiva 12.'),P('6. Recuperación y extras de perfil dependen del backend instalado. Ver docs/AUDITORIA_FUNCIONES.md. Si una función no está habilitada, explicar el límite en su tiempo asignado y usar apoyo visual claramente rotulado, sin simular éxito.'),P('Documento generado desde docs/content-25.json; el texto coincide con SCRIPT.md y el guion privado de las escenas.','NoteAG')])
def footer(c,d):
 c.saveState();c.setFont('BuscAG',8);c.setFillColor(colors.HexColor('#516273'));c.drawString(43,23,'Guion privado · BuscAG · 25 minutos · revisión funcional');c.drawRightString(A4[0]-43,23,str(d.page));c.restoreState()
doc.build(flow,onFirstPage=footer,onLaterPages=footer)
print(output)

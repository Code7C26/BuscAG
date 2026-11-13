export const V2={width:1920,height:1080,fps:30,seconds:60,frames:1800,bpm:120,beatFrames:15,drop:32};
// Every editorial cut is on the 120 BPM grid. No left-text/right-screen layout.
export const SHOTS=[
 ['mystery',0,2,'intro',''],['lost',2,3.5,'type','PERDISTE'],['something',3.5,5,'object','ALGO'],
 ['brand',5,7,'brand',''],['community',7,9.5,'home',''],['together',9.5,10.5,'type','ENCONTRARNOS'],['cards',10.5,12,'cards',''],
 ['publish-title',12,13,'type','PUBLICALO'],['publish',13,17,'publish',''],['search-title',17,18,'type','BUSCÁ'],
 ['search',18,21,'search',''],['filters',21,24,'filters','ZONA / FECHA'],['map',24,27,'map','CERCA TUYO'],
 ['flash-home',27,27.5,'home',''],['flash-search',27.5,28,'search',''],['flash-map',28,28.5,'map',''],
 ['collision',28.5,30,'collision','LAS PISTAS'],['build',30,31.5,'collision','SE CONECTAN'],['suspense',31.5,32,'suspense',''],
 ['drop',32,35,'match','COINCIDENCIAS'],['match-detail',35,38,'match-detail','AUTOMÁTICAS'],['connect',38,40,'cards','CONECTÁ'],
 ['chat-title',40,41,'type','CONECTÁ'],['chat',41,45,'chat',''],['two-sides',45,46.5,'duo',''],
 ['recovery',46.5,49,'recovery',''],['recovered',49,51,'recovered','RECUPERALO'],['return',51,53,'return','VOLVIÓ'],
 ['final-reveal',53,55.5,'final-reveal',''],['final',55.5,60,'final','Lo que se pierde, nos une.']
].map(([id,from,to,kind,text])=>({id:String(id),from:Number(from),to:Number(to),kind:String(kind),text:String(text)}));
export const CLIPS={home:6,publish:6,search:6,map:6,match:5,chat:6,recovery:5};

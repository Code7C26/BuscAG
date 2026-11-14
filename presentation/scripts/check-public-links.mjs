// GET only: no login, account data, SQL or deployment.
const candidates=['https://buscag-prueba.web.app','https://buscag-2677c.web.app','https://github.com/Code7C26/BuscAG'];const result=[];
for(const url of candidates){try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});const html=(await r.text()).slice(0,50000);result.push({url,status:r.status,title:html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]||'',accessibleWithoutLogin:r.ok,knownPrivateRepository:url.includes('github.com/Code7C26/BuscAG'),limitation:'HTTP only; does not verify authenticated MVP functions or physical phones'});}catch{result.push({url,status:'BLOCKED_OR_UNREACHABLE',accessibleWithoutLogin:false});}}
console.log(JSON.stringify(result,null,2));

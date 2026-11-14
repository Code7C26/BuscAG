export function httpsOrigin(value){
 try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/'||!url.hostname.includes('.')||!/[a-z]$/i.test(url.hostname)||/(^|\.)(localhost|local|internal|invalid|test)$/.test(url.hostname))return '';return url.origin;}catch{return '';}
}
export function voteUrl(origin,id){const valid=httpsOrigin(origin);return valid&&['search','object'].includes(id)?valid+'/vote?poll='+id:'';}
export function safeLink(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!/(^|\.)(localhost|local|internal)$/.test(url.hostname)&&!/^\[|^127\.|^10\.|^192\.168\.|^0\./.test(url.hostname)?url.href:'';}catch{return '';}}

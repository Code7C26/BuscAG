import {t, useLanguage} from "../i18n";
import React,{useState} from 'react';
/** Failed remote avatars keep a stable, accessible identity without broken-image UI. */
export function Avatar({src,name,className=''}:{src?:string;name:string;className?:string}){
  useLanguage();
 const [failed,setFailed]=useState<string|null>(null);
 if(src&&failed!==src)return <img src={src} alt={name} className={className} onError={()=>setFailed(src)}/>;
 const initials=(name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')||'?').toUpperCase();
 return <span role="img" aria-label={name||t('Cuenta')} className={'avatar-fallback '+className}>{initials}</span>;
}

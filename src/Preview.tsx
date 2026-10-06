import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { pdfjs } from './pdfjs';
import type { Language, Stamp } from './types';
import { translate } from './i18n';
export default function Preview({bytes, language, page = 1, onPage, stamp, pageKey, onPlace}: {bytes?: Uint8Array; language: Language; page?: number; onPage?: (page:number)=>void; stamp?: Stamp; pageKey?: string; onPlace?: (x:number,y:number)=>void}) {
 const canvas = useRef<HTMLCanvasElement>(null); const [count,setCount] = useState(0); const [error,setError] = useState(false); const [loading,setLoading] = useState(false);
 const [ratio,setRatio] = useState(1.414); const [stampUrl,setStampUrl] = useState('');
 const t = (key: Parameters<typeof translate>[1]) => translate(language,key);
 useEffect(() => {
  if (!stamp) {setStampUrl(''); return;}
  const url=URL.createObjectURL(new Blob([new Uint8Array(stamp.bytes).buffer],{type:'image/png'})); setStampUrl(url); return () => URL.revokeObjectURL(url);
 },[stamp]);
 useEffect(() => {
  if (!bytes) {setCount(0); return;}
  let cancelled=false; let render: ReturnType<pdfjs.PDFPageProxy['render']> | undefined;
  const task=pdfjs.getDocument({data: bytes.slice()}); setLoading(true); setError(false);
  void (async () => {
   try {
    const doc=await task.promise; if(cancelled)return; setCount(doc.numPages);
    const pdfPage=await doc.getPage(Math.min(page,doc.numPages)); if(cancelled)return;
    const viewport=pdfPage.getViewport({scale:1}); const scale=Math.min(1.5,900/viewport.width); const view=pdfPage.getViewport({scale});
    setRatio(view.height/view.width); const node=canvas.current; if(!node)return; node.height=view.height; node.width=view.width;
    render=pdfPage.render({canvas:node,viewport:view}); await render.promise; if(!cancelled)setLoading(false);
   } catch(e) {if(!cancelled && !(e instanceof Error && e.name==='RenderingCancelledException')) {setError(true);setLoading(false);}}
  })();
  return () => {cancelled=true;render?.cancel();void task.destroy();};
 },[bytes,page]);
 const placement=pageKey ? stamp?.placements[pageKey] : undefined;
 return <div className="preview-component">
  {!bytes ? <div className="empty-preview">{t('emptyPreview')}</div> : <>
   <div className="preview-toolbar"><button className="icon-button" aria-label={t('prev')} disabled={page<=1} onClick={()=>onPage?.(page-1)}><span style={{display:"flex",transform:"rotate(180deg)"}}><Icon name="chevron" size={16}/></span></button><span>{t('page')} {page} {t('of')} {count || '?'}</span><button className="icon-button" aria-label={t('next')} disabled={page>=count} onClick={()=>onPage?.(page+1)}><Icon name="chevron" size={16}/></button></div>
   {error ? <p role="alert">{t('damaged')}</p> : <div className={`paper ${onPlace?'placeable':''}`} style={{aspectRatio:`1 / ${ratio}`}} onClick={e=>{if(!onPlace)return;const r=e.currentTarget.getBoundingClientRect();onPlace((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);}}>
    <canvas ref={canvas} aria-label={t('zoom')} />
    {loading && <div className="rendering">{t('loadingPreview')}</div>}
    {placement && stamp && <img className="stamp-overlay" alt={t('seal')} src={stampUrl} style={{left:`${placement.x*100}%`,top:`${placement.y*100}%`,width:`${placement.width*100}%`}}/>}
   </div>}
  </>}
 </div>;
}

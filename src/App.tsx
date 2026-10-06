import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Language, Requirements, UploadedPDF } from './types';
import { InputError, inspectPDF, MAX_BYTES, MAX_FILES, sampleFiles, validateRequirements } from './core';
import { translate } from './i18n';
import type { MessageKey } from './i18n';
import { Icon } from './Icon';
import Preview from './Preview';

export default function App() {
 const [language,setLanguage]=useState<Language>(()=>{try{return localStorage.getItem('tenderdesk-language')==='bn'?'bn':'en';}catch{return 'en';}});
 const t=(key:MessageKey)=>translate(language,key);
 const [data,setData]=useState<Requirements>(); const [files,setFiles]=useState<UploadedPDF[]>([]);
 const [busy,setBusy]=useState(false); const lock=useRef(false);
 const [notices,setNotices]=useState<{key:MessageKey;detail?:string;error?:boolean}[]>([]);
 const [active,setActive]=useState<'workspace'|'documents'|'package'|'tools'>('workspace');
 const [selected,setSelected]=useState<string>(); const [previewPage,setPreviewPage]=useState(1);
 const requirementsInput=useRef<HTMLInputElement>(null); const filesInput=useRef<HTMLInputElement>(null);
 const selectedFile=files.find(f=>f.id===selected);
 useEffect(()=>{document.documentElement.lang=language;try{localStorage.setItem('tenderdesk-language',language);}catch{/* Preferences are optional. */}},[language]);
 const notice=(key:MessageKey,detail?:string,error=false)=>setNotices([{key,detail,error}]);
 async function run(action:()=>Promise<void>) {
  if(lock.current)return; lock.current=true;setBusy(true);setNotices([]);
  try{await action();}catch(e){notice(e instanceof InputError ? e.code : 'loadError',undefined,true);}finally{lock.current=false;setBusy(false);}
 }
 async function importRequirements(event:ChangeEvent<HTMLInputElement>) {
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  await run(async()=>{let parsed:Requirements;try{parsed=validateRequirements(JSON.parse(await file.text()));}catch{throw new InputError('jsonError');}
   if(data && !window.confirm(t('confirmReplace')))return;setData(parsed);notice('requirementsLoaded');
  });
 }
 async function upload(incoming:File[]) {
  await run(async()=>{
   const accepted=[...files];const errors:{key:MessageKey;detail:string;error:boolean}[]=[];
   for(const file of incoming){try{
    if(accepted.length>=MAX_FILES)throw new InputError('tooMany');
    if(accepted.reduce((n,f)=>n+f.size,0)+file.size>MAX_BYTES)throw new InputError('tooLarge');
    accepted.push(await inspectPDF(file));
   }catch(e){errors.push({key:e instanceof InputError?e.code:'damaged',detail:file.name,error:true});}}
   setFiles(accepted);setNotices(errors);if(!selected && accepted[0]){setSelected(accepted[0].id);setPreviewPage(1);}
  });
 }
 async function loadSample(){await run(async()=>{
  if((data || files.length) && !window.confirm(t('sampleReplace')))return;
  const response=await fetch('/sample-pack/requirements.json');if(!response.ok)throw new Error('sample');
  const sampleData=validateRequirements(await response.json());const loaded:UploadedPDF[]=[];
  for(const name of sampleFiles){const res=await fetch(`/sample-pack/documents/${encodeURIComponent(name)}`);if(!res.ok)throw new Error('sample');loaded.push(await inspectPDF(new File([await res.blob()],name,{type:'application/pdf'})));}
  setData(sampleData);setFiles(loaded);setSelected(loaded[0].id);setPreviewPage(1);notice('sampleLoaded');
 });}
 function removeFile(id:string){setFiles(files.filter(f=>f.id!==id));if(selected===id){setSelected(undefined);setPreviewPage(1);}notice('fileRemoved');}
 const blocking=data?.requirements.filter(r=>r.mandatory).length || 0;
 const totalPages=files.reduce((n,f)=>n+f.pages,0);
 const nav=[{id:'workspace',key:'overview',icon:'grid'},{id:'documents',key:'documents',icon:'file'},{id:'package',key:'package',icon:'package'},{id:'tools',key:'tools',icon:'tools'}] as const;
 return <div className="app-shell">
  <aside className="sidebar">
   <a className="brand" href="#" onClick={e=>{e.preventDefault();setActive('workspace');}}><span className="brand-mark"><Icon name="file" size={25}/></span><span>Tender<span className="brand-light">Desk</span><small>{t('workspace')}</small></span></a>
   <div className="sidebar-label">{t('eyebrow')}</div>
   <nav aria-label={t('navLabel')}>{nav.map(item=><button key={item.id} className={`nav-item ${active===item.id?'active':''}`} onClick={()=>setActive(item.id)}><Icon name={item.icon}/><span>{t(item.key)}</span>{item.id==='documents'&&files.length>0&&<span className="nav-count">{files.length}</span>}</button>)}</nav>
   <div className="sidebar-bottom"><div className="privacy"><Icon name="lock"/><strong>{t('private')}</strong><p>{t('privateHelp')}</p></div><div className="profile"><span className="avatar">MM</span><div><strong>Md.Morsalin</strong><small>0242310005101578</small></div></div></div>
  </aside>
  <div className="main-shell">
   <header className="topbar"><div className="breadcrumb">{t('workspace')}<Icon name="chevron" size={14}/><strong>{t(nav.find(n=>n.id===active)!.key)}</strong></div><button className="language-button" aria-label={t('switch')} onClick={()=>setLanguage(language==='en'?'bn':'en')}><Icon name="globe" size={17}/><span>{language==='en'?'বাংলা':'English'}</span></button></header>
   <main>
    <section className="heading"><div><div className="eyebrow">{t('eyebrow')}</div><h1>{t('heading')}</h1><p>{t('subtitle')}</p></div><div className="heading-actions"><button className="button secondary" disabled={busy} onClick={()=>requirementsInput.current?.click()}><Icon name="upload" size={17}/>{t('import')}</button><button className="button primary" disabled={busy} onClick={loadSample}><Icon name="plus" size={17}/>{t('sample')}</button></div></section>
    <input hidden ref={requirementsInput} type="file" accept=".json,application/json" aria-label={t('import')} onChange={importRequirements}/>
    <input hidden ref={filesInput} type="file" multiple accept=".pdf,application/pdf" aria-label={t('upload')} onChange={e=>{const f=Array.from(e.target.files||[]);e.target.value='';void upload(f);}}/>
    {notices.map((n,i)=><div key={i} className={`notice ${n.error?'error':'success'}`} role={n.error?'alert':'status'}><Icon name={n.error?'alert':'check'} size={18}/><span>{n.detail && <strong>{n.detail}: </strong>}{t(n.key)}</span><button className="icon-button" aria-label={t('close')} onClick={()=>setNotices(notices.filter((_,j)=>j!==i))}><Icon name="close" size={16}/></button></div>)}
    {busy&&<div className="notice" role="status"><span className="spinner"/>{t('processing')}</div>}
    <section className="stats" aria-label={t('overview')}>
     {[{key:'total',value:data?.requirements.length||0,icon:'file',color:'blue'},{key:'ready',value:0,icon:'check',color:'green'},{key:'issues',value:blocking,icon:'alert',color:'orange'},{key:'pageCount',value:totalPages,icon:'package',color:'purple'}].map(s=><div className="stat-card" key={s.key}><div><span>{t(s.key as MessageKey)}</span><strong>{s.value.toLocaleString(language==='bn'?'bn-BD':'en-US')}</strong></div><span className={`stat-icon ${s.color}`}><Icon name={s.icon as 'file'}/></span></div>)}
    </section>
    {data&&<section className="tender-card"><div className="tender-title"><span className="mini-label">{t('tender')}</span><h2>{data.tender.title}</h2><span className="tender-id">{data.tender.tender_id}</span></div><dl><div><dt>{t('bidder')}</dt><dd>{data.tender.bidder}</dd></div><div><dt>{t('entity')}</dt><dd>{data.tender.procuring_entity}</dd></div><div><dt>{t('deadline')}</dt><dd className="deadline">{data.tender.submission_deadline}</dd></div></dl></section>}
    {active==='package'?<section className="panel"><div className="panel-header"><div><h2>{t('package')}</h2><p>{t('packageHelp')}</p></div></div><Preview bytes={selectedFile?.bytes} language={language} page={previewPage} onPage={setPreviewPage}/></section>:<div className="workspace-grid">
     <div className="workspace-main">
      <section className="panel checklist-panel"><div className="panel-header"><div><h2>{t('checklist')} <span className="count-badge">{data?.requirements.length||0}</span></h2><p>{t('checklistHelp')}</p></div></div>
       {!data?<div className="empty-state"><span className="empty-icon"><Icon name="file" size={32}/></span><h3>{t('noRequirements')}</h3><p>{t('emptyHelp')}</p><button className="button secondary" disabled={busy} onClick={()=>requirementsInput.current?.click()}>{t('import')}</button></div>:<div className="table-scroll"><table><thead><tr><th>{t('document')}</th><th>{t('file')}</th><th>{t('status')}</th></tr></thead><tbody>{data.requirements.map((r,i)=><tr key={r.id}><td><div className="document-name"><span className="row-number">{String(i+1).padStart(2,'0')}</span><div><strong>{language==='en'?r.title_en:r.title_bn}</strong><small>{t(r.mandatory?'required':'optional')}</small></div></div></td><td><span className="muted">?</span></td><td><span className={`status ${r.mandatory?'missing':'notProvided'}`}>{t(r.mandatory?'missing':'notProvided')}</span></td></tr>)}</tbody></table></div>}
      </section>
      <section className="panel files-panel"><div className="panel-header"><div><h2>{t('files')} <span className="count-badge">{files.length}</span></h2><p>{t('fileHint')}</p></div><span className="size-label">{(files.reduce((n,f)=>n+f.size,0)/1024/1024).toFixed(1)} / 50 MB</span></div>
       {!files.length?<div className="empty-files">{t('noFiles')}</div>:<div className="file-list">{files.map(f=><div className={`file-item ${selected===f.id?'selected':''}`} key={f.id}><span className="pdf-icon"><Icon name="file"/></span><button className="file-title" onClick={()=>{setSelected(f.id);setPreviewPage(1);}}><strong>{f.name}</strong><span>{f.pages} {t('pages')} · {(f.size/1024).toFixed(0)} KB</span></button>{files.filter(x=>x.hash===f.hash).length>1&&<span className="duplicate-tag">{t('duplicate')}</span>}<button className="icon-button" aria-label={`${t('preview')} ${f.name}`} onClick={()=>{setSelected(f.id);setPreviewPage(1);}}><Icon name="eye" size={18}/></button><button className="icon-button danger" disabled={busy} aria-label={`${t('remove')} ${f.name}`} onClick={()=>removeFile(f.id)}><Icon name="trash" size={17}/></button></div>)}</div>}
      </section>
     </div>
     <div className="workspace-side">
      <section className="panel upload-panel" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)void upload(Array.from(e.dataTransfer.files));}}><div className="upload-symbol"><Icon name="upload" size={30}/></div><h2>{t('uploadTitle')}</h2><p>{t('uploadHelp')}</p><small>{t('limits')}</small><button className="button secondary" disabled={busy} onClick={()=>filesInput.current?.click()}><Icon name="plus" size={17}/>{t('browse')}</button></section>
      <section className="panel readiness"><div className="readiness-title"><h2>{t('progress')}</h2><strong>0%</strong></div><div className="progress-track"><span style={{width:'0%'}}/></div><p>{t(data?'blockers':'importFirst')}</p><button className="button primary wide" disabled><Icon name="package" size={18}/>{t('generate')}</button></section>
      <section className="panel small-preview"><div className="panel-header"><h2>{t('preview')}</h2>{selectedFile&&<span className="count-badge">{selectedFile.pages} {t('pages')}</span>}</div>{selectedFile&&<p className="preview-name">{selectedFile.name}</p>}<Preview bytes={selectedFile?.bytes} language={language} page={previewPage} onPage={setPreviewPage}/></section>
     </div>
    </div>}
   </main><footer className="app-footer"><span>TenderDesk · AI DevFest 2026</span><span><Icon name="lock" size={13}/>{t('private')}</span></footer>
  </div>
 </div>;
}

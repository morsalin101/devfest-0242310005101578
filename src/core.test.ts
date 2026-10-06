import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument, degrees } from 'pdf-lib';
import { assignFile, checklist, getStatus, inspectPDF, isBlocking, MAX_BYTES, validateRequirements, validDate } from './core';
import { generatePackage } from './package';
import type { Assignments, UploadedPDF } from './types';
const data=validateRequirements(JSON.parse(readFileSync('public/sample-pack/requirements.json','utf8')));
const bytes=new Uint8Array(readFileSync('public/sample-pack/documents/experience_cert.pdf'));
const fake:UploadedPDF={id:'f1',name:'experience.pdf',hash:'abc',size:bytes.length,pages:2,bytes};
const mandatory=data.requirements[0];const optional=data.requirements[6];
describe('requirements and dates',()=>{
 it('sorts by required order',()=>expect(validateRequirements({...data,requirements:[...data.requirements].reverse()}).requirements[0].id).toBe('R01'));
 it.each([null,{}, {...data,tender:{...data.tender,submission_deadline:'2026-02-30'}},{...data,requirements:[mandatory,mandatory]},{...data,requirements:[{...mandatory,mandatory:'true'}]},{...data,requirements:[{...mandatory,id:'__proto__'}]}])('rejects malformed input %#',input=>expect(()=>validateRequirements(input)).toThrow('jsonError'));
 it('rejects impossible dates and accepts leap dates',()=>{expect(validDate('2026-02-29')).toBe(false);expect(validDate('2024-02-29')).toBe(true);});
});
describe('exact document statuses',()=>{
 it('missing mandatory / absent optional',()=>{expect(getStatus(mandatory,undefined,'','2026-10-20')).toBe('missing');expect(getStatus(optional,undefined,'','2026-10-20')).toBe('notProvided');});
 it('needs an expiry, including invalid dates',()=>{expect(getStatus(mandatory,fake,'','2026-10-20')).toBe('dateNeeded');expect(getStatus(mandatory,fake,'2026-02-30','2026-10-20')).toBe('dateNeeded');});
 it.each([['2026-10-19','expired'],['2026-10-20','ok'],['2026-10-21','ok']])('deadline comparison %s', (date,status)=>expect(getStatus(mandatory,fake,date,'2026-10-20')).toBe(status));
 it('optional matched expiry still blocks',()=>expect(isBlocking(getStatus(optional,fake,'2026-01-01','2026-10-20'))).toBe(true));
 it('requirements without expiry pass with a match',()=>expect(getStatus(data.requirements[1],fake,'','2026-10-20')).toBe('ok'));
 it('a removed file becomes missing',()=>expect(checklist(data,[],{R01:'f1'},{R01:'2027-01-01'})[0].status).toBe('missing'));
});
describe('exclusive assignment by content',()=>{
 const duplicate={...fake,id:'f2',name:'renamed.pdf'};const other={...fake,id:'f3',hash:'other'};
 it('blocks the same file and renamed identical content',()=>{expect(()=>assignFile('R02','f1',{R01:'f1'},[fake])).toThrow('matchConflict');expect(()=>assignFile('R02','f2',{R01:'f1'},[fake,duplicate])).toThrow('matchConflict');});
 it('allows changing and undoing a match',()=>{expect(assignFile('R01','f2',{R01:'f1'},[fake,duplicate])).toEqual({R01:'f2'});expect(assignFile('R01','',{R01:'f1'},[fake])).toEqual({});expect(assignFile('R02','f3',{R01:'f1'},[fake,other])).toEqual({R01:'f1',R02:'f3'});});
});
describe('PDF intake',()=>{
 it('counts pages and hashes byte-identical files independently of names',async()=>{const a=await inspectPDF(new File([bytes],'a.pdf'));const b=await inspectPDF(new File([bytes],'b.pdf'));expect(a.pages).toBe(2);expect(a.hash).toBe(b.hash);expect(a.id).not.toBe(b.id);});
 it('rejects non-PDF and malformed PDFs',async()=>{await expect(inspectPDF(new File([bytes],'logo.png'))).rejects.toThrow('notPdf');await expect(inspectPDF(new File(['hello'],'hello.pdf'))).rejects.toThrow('notPdf');await expect(inspectPDF(new File(['%PDF-1.7\ncorrupt'],'broken.pdf'))).rejects.toThrow('damaged');});
 it('rejects over 50 MB before parsing',async()=>await expect(inspectPDF(new File([new Uint8Array(MAX_BYTES+1)],'large.pdf'))).rejects.toThrow('tooLarge'));
 it('rejects encrypted files without attempting to ignore encryption',async()=>{const pdf=await PDFDocument.load(bytes);pdf.context.trailerInfo.Encrypt=pdf.context.register(pdf.context.obj({Filter:'Standard',V:1,R:2,Length:40}));const encrypted=await pdf.save({useObjectStreams:false});await expect(inspectPDF(new File([new Uint8Array(encrypted).buffer],'locked.pdf'))).rejects.toThrow('encrypted');});
});
describe('compliant PDF package',()=>{
 it('refuses incomplete mandatory checklists',async()=>await expect(generatePackage(data,[],{},{})).rejects.toThrow('blocking'));
 it('builds the checked sample with 16 pages and expected starts',async()=>{
  const names=['trade_license_2026.pdf','03_tin_certificate.pdf','04_vat_certificate.pdf','bank_solvency.pdf','experience_cert.pdf','02_technical_proposal.pdf','01_financial_proposal.pdf','scan_0042.pdf'];
  const ids=['R01','R02','R03','R04','R05','R08','R09','R10'];const files:UploadedPDF[]=[];const assignments:Assignments={};
  for(let i=0;i<names.length;i++){const f=await inspectPDF(new File([readFileSync(`public/sample-pack/documents/${names[i]}`)],names[i]));files.push(f);assignments[ids[i]]=f.id;}
  const output=await generatePackage(data,files,assignments,{R01:'2027-06-30',R04:'2026-12-31'});const pdf=await PDFDocument.load(output.bytes);
  expect(pdf.getPageCount()).toBe(16);expect(output.starts).toEqual({R01:2,R02:3,R03:4,R04:5,R05:6,R08:8,R09:14,R10:16});expect(output.pageKeys.length).toBe(16);
  const source=await PDFDocument.load(files[0].bytes);expect(pdf.getPage(1).getHeight()).toBe(source.getPage(0).getCropBox().height+40);
 });
 it('preserves rotated source dimensions and adds footer space',async()=>{
  const source=await PDFDocument.load(bytes);source.getPage(0).setRotation(degrees(90));const changed=await source.save();const f=await inspectPDF(new File([new Uint8Array(changed).buffer],'experience.pdf'));
  const single={...data,requirements:[data.requirements[4]]};const out=await generatePackage(single,[f],{R05:f.id},{});const pdf=await PDFDocument.load(out.bytes);
  expect(pdf.getPage(1).getWidth()).toBe(source.getPage(0).getHeight());expect(pdf.getPage(1).getHeight()).toBe(source.getPage(0).getWidth()+40);
 });
});

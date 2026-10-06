import { PDFDocument } from 'pdf-lib';
import type { Requirements, UploadedPDF, Requirement, Assignments, Expiries, Status } from './types';
export const MAX_FILES = 30;
export const MAX_BYTES = 50 * 1024 * 1024;
export class InputError extends Error { constructor(public code: 'jsonError'|'notPdf'|'damaged'|'encrypted'|'tooMany'|'tooLarge'|'matchConflict'|'projectError') { super(code); } }
export function validDate(value: unknown): value is string {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const date = new Date(`${value}T00:00:00Z`);
 return !isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function validateRequirements(value: unknown): Requirements {
 if (!value || typeof value !== 'object') throw new InputError('jsonError');
 const v = value as Requirements;
 const tender = v.tender;
 if (!tender || !['tender_id','title','procuring_entity','bidder'].every(k => typeof tender[k as keyof typeof tender] === 'string' && tender[k as keyof typeof tender].trim()) || !validDate(tender.submission_deadline) || !Array.isArray(v.requirements) || !v.requirements.length) throw new InputError('jsonError');
 const ids = new Set<string>(); const orders = new Set<number>();
 for (const r of v.requirements) {
  if (!r || typeof r.id !== 'string' || !r.id.trim() || ['__proto__','constructor','prototype'].includes(r.id) || ids.has(r.id) || !Number.isInteger(r.order) || r.order < 1 || orders.has(r.order) || typeof r.title_en !== 'string' || !r.title_en.trim() || typeof r.title_bn !== 'string' || !r.title_bn.trim() || typeof r.mandatory !== 'boolean' || typeof r.has_expiry !== 'boolean') throw new InputError('jsonError');
  ids.add(r.id); orders.add(r.order);
 }
 return {tender: {...tender}, requirements: [...v.requirements].sort((a,b) => a.order - b.order)};
}
export async function inspectPDF(file: File): Promise<UploadedPDF> {
 if (!/\.pdf$/i.test(file.name)) throw new InputError('notPdf');
 if (file.size > MAX_BYTES) throw new InputError('tooLarge');
 const bytes = new Uint8Array(await file.arrayBuffer());
 const header = new TextDecoder().decode(bytes.slice(0,1024));
 if (!header.includes('%PDF-')) throw new InputError('notPdf');
 let pdf: PDFDocument;
 try { pdf = await PDFDocument.load(bytes); if (pdf.isEncrypted) throw new InputError('encrypted'); if (!pdf.getPageCount()) throw new InputError('damaged'); }
 catch (error) { if (error instanceof InputError) throw error; if (/encrypt|password/i.test(String(error))) throw new InputError('encrypted'); throw new InputError('damaged'); }
 const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(v => v.toString(16).padStart(2,'0')).join('');
 return {id: crypto.randomUUID(), name: file.name, size: bytes.byteLength, pages: pdf.getPageCount(), hash, bytes};
}
export function download(bytes: Uint8Array | string, name: string, type: string) {
 const data = typeof bytes === 'string' ? bytes : new Uint8Array(bytes).buffer;
 const url = URL.createObjectURL(new Blob([data], {type}));
 const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
 setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const sampleFiles = ['experience_cert.pdf','trade_license_2026.pdf','01_financial_proposal.pdf','trade_license_2025.pdf','03_tin_certificate.pdf','scan_0042.pdf','experience_cert (1).pdf','bank_solvency.pdf','02_technical_proposal.pdf','04_vat_certificate.pdf'];

export function getStatus(requirement: Requirement, file: UploadedPDF | undefined, expiry: string | undefined, deadline: string): Status {
 if (!file) return requirement.mandatory ? 'missing' : 'notProvided';
 if (requirement.has_expiry) {
  if (!validDate(expiry)) return 'dateNeeded';
  if (expiry < deadline) return 'expired';
 }
 return 'ok';
}
export function checklist(data: Requirements, files: UploadedPDF[], assignments: Assignments, expiries: Expiries) {
 return data.requirements.map(requirement => {
  const file=files.find(f=>f.id===assignments[requirement.id]);
  return {requirement,file,status:getStatus(requirement,file,expiries[requirement.id],data.tender.submission_deadline)};
 });
}
export function isBlocking(status: Status) { return status==='missing' || status==='dateNeeded' || status==='expired'; }
export function assignFile(requirementId: string, fileId: string, assignments: Assignments, files: UploadedPDF[]): Assignments {
 const next={...assignments};delete next[requirementId];
 if (!fileId) return next;
 const file=files.find(f=>f.id===fileId);
 if (!file) throw new InputError('matchConflict');
 for (const id of Object.values(next)) if(files.find(f=>f.id===id)?.hash===file.hash) throw new InputError('matchConflict');
 next[requirementId]=fileId;return next;
}
export function safeFilename(id: string) { return id.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_'); }

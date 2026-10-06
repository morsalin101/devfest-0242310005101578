export type Language = 'en' | 'bn';
export interface Requirement { id: string; order: number; title_en: string; title_bn: string; mandatory: boolean; has_expiry: boolean }
export interface Tender { tender_id: string; title: string; procuring_entity: string; bidder: string; submission_deadline: string }
export interface Requirements { tender: Tender; requirements: Requirement[] }
export interface UploadedPDF { id: string; name: string; size: number; pages: number; hash: string; bytes: Uint8Array }
export type Assignments = Record<string, string>;
export type Expiries = Record<string, string>;
export type Status = 'missing' | 'dateNeeded' | 'expired' | 'notProvided' | 'ok';
export interface Stamp { bytes: Uint8Array; name: string; width: number; height: number; placements: Record<string, {x: number; y: number; width: number}> }
export interface PackageOptions { index: boolean; language: Language; stamp?: Stamp }
export interface Suggestion { requirementId: string; fileId: string; reason?: string }

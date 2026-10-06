import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import type { Assignments, Expiries, Requirements, UploadedPDF, PackageOptions } from './types';
import { checklist, isBlocking } from './core';
export interface GeneratedPackage { bytes: Uint8Array; pages: number; pageKeys: string[]; starts: Record<string,number> }
const FOOTER=40;
function wrap(text:string,font:PDFFont,size:number,width:number):string[] {
 const lines:string[]=[];
 for(const paragraph of text.split('\n')) {
  let line='';
  for(const word of paragraph.split(/\s+/)) {
   const candidate=line?`${line} ${word}`:word;
   if(font.widthOfTextAtSize(candidate,size)>width && line){lines.push(line);line=word;}else line=candidate;
  }
  lines.push(line);
 }
 return lines;
}
export async function generatePackage(data:Requirements, files:UploadedPDF[], assignments:Assignments, expiries:Expiries, _options?:PackageOptions):Promise<GeneratedPackage> {
 const rows=checklist(data,files,assignments,expiries);
 if(rows.some(r=>isBlocking(r.status)))throw new Error('blocking');
 const included=rows.filter(r=>r.file);
 const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const cover=pdf.addPage([595.28,841.89]);const pageKeys=['cover'];const starts:Record<string,number>={};
 const ink=rgb(.08,.16,.25), muted=rgb(.35,.43,.51),teal=rgb(.08,.48,.45);
 const write=(page:PDFPage,text:string,x:number,y:number,size=11,strong=false)=>page.drawText(text,{x,y,size,font:strong?bold:font,color:ink});
 cover.drawRectangle({x:0,y:810,width:595.28,height:32,color:teal});
 cover.drawText('TENDER DOCUMENT PACKAGE',{x:40,y:767,size:11,font:bold,color:teal});
 let y=730;
 for(const line of wrap(data.tender.title,bold,22,515)){write(cover,line,40,y,22,true);y-=29;}
 y-=18;
 const values=[['Tender ID',data.tender.tender_id],['Procuring entity',data.tender.procuring_entity],['Bidder',data.tender.bidder],['Submission deadline',data.tender.submission_deadline],['Package creation date',new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())]];
 for(const [label,value] of values){cover.drawText(label.toUpperCase(),{x:40,y,size:8,font:bold,color:muted});y-=19;for(const line of wrap(value,font,11,515)){write(cover,line,40,y);y-=15;}y-=13;}
 y-=8;write(cover,'Included documents (submission order)',40,y,12,true);y-=26;
 let size=11;let docLines=included.map((r,i)=>wrap(`${i+1}. ${r.requirement.title_en}`,font,size,515));
 while(docLines.reduce((n,ls)=>n+ls.length,0)*(size+5)>y-65 && size>7){size-=.5;docLines=included.map((r,i)=>wrap(`${i+1}. ${r.requirement.title_en}`,font,size,515));}
 for(const lines of docLines)for(const line of lines){write(cover,line,40,y,size);y-=size+5;}
 if(y<45)throw new Error('cover too long');
 for(const row of included){
  const source=await PDFDocument.load(row.file!.bytes);starts[row.requirement.id]=pdf.getPageCount()+1;
  for(let i=0;i<source.getPageCount();i++){
   const original=source.getPage(i);const crop=original.getCropBox();
   const embedded=await pdf.embedPage(original,{left:crop.x,bottom:crop.y,right:crop.x+crop.width,top:crop.y+crop.height});
   const angle=((original.getRotation().angle%360)+360)%360;const rotated=angle===90||angle===270;
   const width=rotated?embedded.height:embedded.width;const height=rotated?embedded.width:embedded.height;
   const page=pdf.addPage([width,height+FOOTER]);
   const placement=angle===90?{x:0,y:embedded.width+FOOTER,rotate:degrees(-90)}:angle===180?{x:embedded.width,y:embedded.height+FOOTER,rotate:degrees(180)}:angle===270?{x:embedded.height,y:FOOTER,rotate:degrees(90)}:{x:0,y:FOOTER,rotate:degrees(0)};
   page.drawPage(embedded,placement);pageKeys.push(`${row.requirement.id}:${row.file!.hash}:${i}`);
  }
 }
 const total=pdf.getPageCount();
 pdf.getPages().forEach((page,i)=>{
  const text=`${data.tender.tender_id} | Page ${i+1} of ${total}`;const width=page.getWidth();
  const size=Math.min(9,(width-32)/font.widthOfTextAtSize(text,1));
  page.drawLine({start:{x:16,y:32},end:{x:width-16,y:32},color:rgb(.83,.87,.89),thickness:.5});
  page.drawText(text,{x:(width-font.widthOfTextAtSize(text,size))/2,y:14,size,font,color:muted});
 });
 pdf.setTitle(`${data.tender.tender_id} Tender Document Package`);pdf.setAuthor(data.tender.bidder);pdf.setCreator('TenderDesk');
 return {bytes:await pdf.save(),pages:total,pageKeys,starts};
}

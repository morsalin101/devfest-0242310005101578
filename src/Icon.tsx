export function Icon({name, size = 20}: {name: 'grid'|'file'|'package'|'tools'|'upload'|'download'|'check'|'alert'|'lock'|'chevron'|'trash'|'eye'|'globe'|'plus'|'search'|'save'|'close'; size?: number}) {
 const paths: Record<typeof name, React.ReactNode> = {
 close: <path d="m6 6 12 12M6 18 18 6"/>,
 grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
 file: <><path d="M14 2H5v20h14V7z"/><path d="M14 2v5h5M8 12h8M8 16h6"/></>,
 package: <><path d="m3 7 9-5 9 5v10l-9 5-9-5zM3 7l9 5 9-5M12 12v10M7.5 4.5l9 5"/></>,
 tools: <><path d="m14 6 4-4 4 4-4 4M3 21l12-12M3 3l5 5M16 16l5 5"/><circle cx="6" cy="18" r="2"/></>,
 upload: <><path d="M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5"/></>,
 download: <><path d="M12 3v13m-5-5 5 5 5-5M3 16v5h18v-5"/></>,
 check: <path d="m5 12 4 4L19 6"/>, alert: <><path d="m12 3 10 18H2zM12 9v5"/><path d="M12 17h.01"/></>,
 lock: <><rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3"/></>,
 chevron: <path d="m9 5 7 7-7 7"/>, trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></>,
 eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/></>,
 globe: <><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20"/></>,
 plus: <path d="M12 5v14M5 12h14"/>, search: <><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></>,
 save: <><path d="M3 3h15l3 3v15H3zM7 3v6h10V3M7 21v-8h10v8"/></>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

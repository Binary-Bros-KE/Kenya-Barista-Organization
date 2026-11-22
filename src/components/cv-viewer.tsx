"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

// Views a CV in the page with pdf.js, so nobody has to download it. The file comes from the same
// permission-checked routes as downloads. Only the page contents are drawn: no scripts, forms or links run.
type PdfJs = typeof import("pdfjs-dist");
let library: Promise<PdfJs> | null = null;
function loadPdfJs() {
  library ??= import("pdfjs-dist").then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs;
  });
  return library;
}

const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const icons = {
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  minus: "M5 12h14", plus: "M12 5v14M5 12h14", fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14", close: "M6 6l12 12M18 6 6 18",
};

export function CvViewButton({ src, filename, downloadHref, label = "View CV", className = "cv-view-button" }: { src: string; filename: string; downloadHref?: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)} onPointerEnter={() => void loadPdfJs()}><Icon d={icons.eye} />{label}</button>
    {open && <CvViewer src={src} filename={filename} downloadHref={downloadHref} onClose={() => setOpen(false)} />}
  </>;
}

const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

function CvViewer({ src, filename, downloadHref, onClose }: { src: string; filename: string; downloadHref?: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [pdfjs, setPdfjs] = useState<PdfJs | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let cancelled = false, loading: PDFDocumentLoadingTask | null = null;
    (async () => {
      try {
        const [lib, response] = await Promise.all([loadPdfJs(), fetch(src + (src.includes("?") ? "&" : "?") + "view=1", { credentials: "same-origin", cache: "no-store" })]);
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "This CV can't be shown right now.");
        loading = lib.getDocument({ data: new Uint8Array(await response.arrayBuffer()), enableXfa: false, stopAtErrors: false });
        const loaded = await loading.promise;
        const first = (await loaded.getPage(1)).getViewport({ scale: 1 });
        if (cancelled) return;
        setPdfjs(lib); setDoc(loaded); setPageSize({ width: first.width, height: first.height });
      } catch (problem) {
        if (!cancelled) setError(problem instanceof Error && problem.name !== "InvalidPDFException" ? problem.message : "This file couldn't be opened as a PDF.");
      }
    })();
    // Closing the viewer frees the document and its worker memory.
    return () => { cancelled = true; void loading?.destroy(); };
  }, [src]);

  // Fit to the available width, then apply the zoom.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Fit the page to the window, but no wider than a comfortable reading width.
  const fitScale = pageSize && width ? Math.min(width - 32, 880) / pageSize.width : 1;
  const scale = fitScale * zoom;

  const step = useCallback((direction: 1 | -1) => setZoom(value => {
    const index = ZOOMS.findIndex(level => level >= value - 0.001);
    return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (index < 0 ? ZOOMS.length - 1 : index) + direction))];
  }), []);
  function keys(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "+" || event.key === "=") { event.preventDefault(); step(1); }
    else if (event.key === "-" || event.key === "_") { event.preventDefault(); step(-1); }
    else if (event.key === "0") { event.preventDefault(); setZoom(1); }
  }

  return <dialog ref={dialog} className="cv-viewer" aria-label={`CV: ${filename}`} onClose={onClose} onKeyDown={keys}>
    <header className="cv-viewer-bar">
      <div className="cv-viewer-title"><strong title={filename}>{filename}</strong><span>{doc ? `Page ${current} of ${doc.numPages}` : error ? "Couldn't open" : "Opening…"}</span></div>
      <div className="cv-viewer-tools" role="group" aria-label="Zoom">
        <button type="button" onClick={() => step(-1)} disabled={!doc || zoom <= ZOOMS[0]} aria-label="Zoom out" title="Zoom out (−)"><Icon d={icons.minus} /></button>
        <button type="button" className="cv-viewer-zoom" onClick={() => setZoom(1)} disabled={!doc} title="Fit to width (0)">{zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`}</button>
        <button type="button" onClick={() => step(1)} disabled={!doc || zoom >= ZOOMS[ZOOMS.length - 1]} aria-label="Zoom in" title="Zoom in (+)"><Icon d={icons.plus} /></button>
        {zoom !== 1 && <button type="button" onClick={() => setZoom(1)} aria-label="Fit to width" title="Fit to width"><Icon d={icons.fit} /></button>}
      </div>
      <div className="cv-viewer-actions">
        {downloadHref && <a href={downloadHref} className="cv-viewer-download"><Icon d={icons.download} /><span>Download</span></a>}
        <button type="button" className="cv-viewer-close" onClick={() => dialog.current?.close()} aria-label="Close" autoFocus><Icon d={icons.close} /></button>
      </div>
    </header>
    <div ref={scroller} className="cv-viewer-pages" tabIndex={-1}>
      {error ? <div className="cv-viewer-message" role="alert"><strong>{error}</strong>{downloadHref && <p>You can still <a href={downloadHref}>download the file</a>.</p>}</div>
        : !doc || !pdfjs || !pageSize ? <div className="cv-viewer-message" role="status"><i className="cv-viewer-spinner" aria-hidden="true" />Opening the CV…</div>
        : Array.from({ length: doc.numPages }, (_, index) => <PdfPage key={index} pdfjs={pdfjs} doc={doc} number={index + 1} scale={scale} estimate={pageSize} root={scroller} onVisible={setCurrent} />)}
    </div>
  </dialog>;
}

// One page: a canvas for the drawing and a transparent text layer on top so text can be selected and copied.
// It renders only once it's near the visible area.
function PdfPage({ pdfjs, doc, number, scale, estimate, root, onVisible }: { pdfjs: PdfJs; doc: PDFDocumentProxy; number: number; scale: number; estimate: { width: number; height: number }; root: RefObject<HTMLDivElement | null>; onVisible: (page: number) => void }) {
  const box = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), text = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(number <= 2);
  const [size, setSize] = useState(estimate);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const nearby = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setNear(true); }, { root: root.current, rootMargin: "800px 0px" });
    const shown = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) onVisible(number); }, { root: root.current, threshold: 0.5 });
    nearby.observe(element); shown.observe(element);
    return () => { nearby.disconnect(); shown.disconnect(); };
  }, [number, onVisible, root]);

  useEffect(() => {
    if (!near) return;
    let task: RenderTask | null = null, cancelled = false;
    (async () => {
      const page = await doc.getPage(number);
      const viewport = page.getViewport({ scale });
      if (cancelled || !canvas.current || !text.current) return;
      setSize({ width: viewport.width / scale, height: viewport.height / scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      canvas.current.width = Math.floor(viewport.width * ratio);
      canvas.current.height = Math.floor(viewport.height * ratio);
      task = page.render({ canvas: canvas.current, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
      await task.promise.catch(error => { if (!(error instanceof pdfjs.RenderingCancelledException)) throw error; });
      if (cancelled) return;
      text.current.replaceChildren();
      await new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: text.current, viewport }).render();
    })().catch(() => undefined);
    return () => { cancelled = true; task?.cancel(); };
  }, [near, doc, number, scale, pdfjs]);

  return <div ref={box} className="cv-viewer-page" style={{ width: size.width * scale, height: size.height * scale, "--total-scale-factor": scale, "--scale-factor": scale } as CSSProperties} aria-label={`Page ${number}`}>
    <canvas ref={canvas} style={{ width: "100%", height: "100%" }} />
    <div ref={text} className="textLayer" />
  </div>;
}

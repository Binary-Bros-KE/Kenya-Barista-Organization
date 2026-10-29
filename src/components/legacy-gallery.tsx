"use client";
import { useEffect, useRef, useState } from "react";
type Photo = { src: string; alt: string };
export function LegacyGallery({ photos }: { photos: Photo[] }) {
  const [selected, setSelected] = useState<number | null>(null), dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const available = photos.filter(photo => photo.src);
  useEffect(() => { if (selected !== null && !dialog.current?.open) dialog.current?.showModal(); }, [selected]);
  function close() { dialog.current?.close(); setSelected(null); trigger.current?.focus(); }
  function move(delta: number) { setSelected(value => value === null ? null : (value + delta + available.length) % available.length); }
  return <><div className="legacy-photo-grid">{photos.map((photo, i) => photo.src ? <button key={i} type="button" aria-label={`Open ${photo.alt}`} onClick={event => { trigger.current = event.currentTarget; setSelected(available.indexOf(photo)); }}><img src={photo.src} alt={photo.alt} loading="lazy" /></button> : <div key={i} className="legacy-missing-image">Photo unavailable</div>)}</div>
    <dialog ref={dialog} className="legacy-lightbox" aria-label="Photo gallery viewer" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === dialog.current) close(); }} onKeyDown={event => { if (event.key === "ArrowRight") move(1); if (event.key === "ArrowLeft") move(-1); }}>
      <button type="button" onClick={close} className="mb-4">Close</button>{selected !== null && <img src={available[selected].src} alt={available[selected].alt} />}<div className="legacy-lightbox-controls"><button type="button" onClick={() => move(-1)}>Previous</button><span aria-live="polite">{selected === null ? "" : `${selected + 1} / ${available.length}`}</span><button type="button" onClick={() => move(1)}>Next</button></div>
    </dialog></>;
}

"use client";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { accents, avatarSrc, type Accent } from "@/lib/images";
import { ProfileCard, initialsOf } from "./profile-card";

export type StudioProfile = {
  fullName: string; phone: string; location: string; summary: string; headline: string; experienceYears: number | null;
  skills: string[]; openToWork: boolean; instagram: string; linkedin: string; website: string; accent: string;
};
type Props = { userId: string; avatarVersion: number | null; imagesEnabled: boolean; cvCount: number; initial: StudioProfile };

const suggestedSkills = ["Espresso extraction", "Latte art", "Milk texturing", "Manual brewing", "Cupping", "Grinder calibration", "Coffee roasting", "Customer service", "Cash handling", "Team leadership", "Barista training", "Menu development", "Stock and ordering", "Food safety", "Machine maintenance", "Cocktails and mixology"];
const MAX_SKILLS = 12, MAX_PHOTO = 5 * 1024 * 1024;
const yearOptions = [{ value: "", label: "Prefer not to say" }, { value: "0", label: "Under a year" }, ...Array.from({ length: 19 }, (_, index) => ({ value: String(index + 1), label: `${index + 1} ${index ? "years" : "year"}` })), { value: "20", label: "20 years or more" }];

export function checkPhoto(file: { type: string; size: number }) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Choose a JPG, PNG or WebP photo.";
  if (file.size > MAX_PHOTO) return "Choose a photo up to 5 MB.";
  return "";
}

// What's still missing, in the order that helps most.
export function profileChecklist(profile: StudioProfile, hasPhoto: boolean, cvCount: number) {
  return [
    { label: "Add a profile photo", done: hasPhoto },
    { label: "Write a headline", done: profile.headline.trim().length >= 3 },
    { label: "Add your contact details", done: profile.fullName.trim().length >= 2 && /^\+254[17]\d{8}$/.test(profile.phone.trim()) && profile.location.trim().length >= 2 },
    { label: "Tell recruiters about yourself", done: profile.summary.trim().length >= 80 },
    { label: "Pick at least 3 skills", done: profile.skills.length >= 3 },
    { label: "Share your experience", done: profile.experienceYears != null },
    { label: "Upload a CV", done: cvCount > 0 },
  ];
}

export function ProfileStudio({ userId, avatarVersion, imagesEnabled, cvCount, initial }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [version, setVersion] = useState(avatarVersion);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [customSkill, setCustomSkill] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (localPhoto) URL.revokeObjectURL(localPhoto); }, [localPhoto]);

  const photo = localPhoto ?? avatarSrc(userId, version, 120);
  const checklist = profileChecklist(profile, Boolean(photo), cvCount);
  const score = Math.round(checklist.filter(item => item.done).length / checklist.length * 100);

  function update<K extends keyof StudioProfile>(key: K, value: StudioProfile[K]) { setProfile(current => ({ ...current, [key]: value })); setDirty(true); setMessage(null); }
  function toggleSkill(skill: string) {
    const has = profile.skills.some(item => item.toLowerCase() === skill.toLowerCase());
    if (!has && profile.skills.length >= MAX_SKILLS) { setMessage({ text: `You can pick up to ${MAX_SKILLS} skills.`, error: true }); return; }
    update("skills", has ? profile.skills.filter(item => item.toLowerCase() !== skill.toLowerCase()) : [...profile.skills, skill]);
  }
  function addCustomSkill() {
    const skill = customSkill.trim().replace(/\s+/g, " ");
    if (skill.length < 2 || skill.length > 30) { setMessage({ text: "Skills are 2 to 30 characters long.", error: true }); return; }
    if (!profile.skills.some(item => item.toLowerCase() === skill.toLowerCase())) toggleSkill(skill);
    setCustomSkill("");
  }

  async function uploadPhoto(file: File) {
    const problem = checkPhoto(file);
    if (problem) { setPhotoMessage({ text: problem, error: true }); return; }
    const preview = URL.createObjectURL(file);
    setLocalPhoto(preview); setPhotoBusy(true); setPhotoMessage(null);
    try {
      const response = await fetch("/api/me/avatar", { method: "POST", credentials: "same-origin", headers: { "Content-Type": file.type }, body: file });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Your photo could not be uploaded. Try again.");
      setVersion(data.avatarVersion); setLocalPhoto(null);
      setPhotoMessage({ text: "Photo updated. It now shows across KBO.", error: false }); router.refresh();
    } catch (error) { setLocalPhoto(null); setPhotoMessage({ text: error instanceof Error ? error.message : "Your photo could not be uploaded.", error: true }); }
    finally { setPhotoBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  async function removePhoto() {
    setPhotoBusy(true); setPhotoMessage(null);
    try {
      const response = await fetch("/api/me/avatar", { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Your photo could not be removed.");
      setVersion(null); setPhotoMessage({ text: "Photo removed. Your initials show instead.", error: false }); router.refresh();
    } catch (error) { setPhotoMessage({ text: error instanceof Error ? error.message : "Your photo could not be removed.", error: true }); }
    finally { setPhotoBusy(false); }
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && imagesEnabled && !photoBusy) void uploadPhoto(file);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const response = await fetch("/api/profile", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Your profile could not be saved.");
      setProfile(current => ({ ...current, instagram: data.instagram ? `@${data.instagram}` : "", linkedin: data.linkedin ?? "", website: data.website ?? "", skills: data.skills ?? current.skills }));
      setDirty(false); setMessage({ text: "Profile saved. Recruiters now see these details.", error: false }); router.refresh();
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "Your profile could not be saved.", error: true }); }
    finally { setSaving(false); }
  }

  const card = { name: profile.fullName, headline: profile.headline || null, location: profile.location || null, experienceYears: profile.experienceYears, skills: profile.skills, openToWork: profile.openToWork, summary: profile.summary, accent: profile.accent, photo, instagram: profile.instagram.replace(/^@/, "") || null, linkedin: profile.linkedin || null, website: profile.website || null };
  return <div className="studio">
    <form className="studio-editor" onSubmit={event => void save(event)} aria-busy={saving}>
      <section className="studio-panel">
        <header><span className="studio-step">01</span><div><h2>Photo and colour</h2><p>A friendly, clear photo helps recruiters remember you.</p></div></header>
        <div className={`studio-photo${dragging ? " is-dragging" : ""}`} onDragOver={event => { event.preventDefault(); if (imagesEnabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
          <div className="studio-photo-frame">{photo ? <img src={photo} alt="Your profile photo" /> : <span>{initialsOf(profile.fullName)}</span>}{photoBusy && <i className="studio-photo-spinner" aria-hidden="true" />}</div>
          <div className="studio-photo-copy">
            {imagesEnabled ? <>
              <strong>{photo ? "Looking good." : "Add a photo of yourself"}</strong>
              <p>Drag a photo here or choose one. JPG, PNG or WebP, up to 5 MB. We centre it on your face.</p>
              <div className="studio-photo-actions">
                <button type="button" className="studio-button" disabled={photoBusy} onClick={() => fileInput.current?.click()}>{photoBusy ? "Uploading…" : photo ? "Change photo" : "Choose photo"}</button>
                {version && <button type="button" className="studio-link is-danger" disabled={photoBusy} onClick={() => void removePhoto()}>Remove</button>}
              </div>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void uploadPhoto(file); }} />
            </> : <><strong>Photo uploads are coming soon</strong><p>We're finishing the photo service. Your initials show until then.</p></>}
            {photoMessage && <p className={`studio-note${photoMessage.error ? " is-error" : ""}`} role={photoMessage.error ? "alert" : "status"}>{photoMessage.text}</p>}
          </div>
        </div>
        <fieldset className="studio-accents"><legend>Card colour</legend>
          <div>{(Object.entries(accents) as [Accent, (typeof accents)[Accent]][]).map(([key, theme]) => <label key={key} className={profile.accent === key ? "is-on" : ""} style={{ background: `linear-gradient(140deg, ${theme.from}, ${theme.to})` }}>
            <input type="radio" name="accent" value={key} checked={profile.accent === key} onChange={() => update("accent", key)} /><span>{theme.label}</span></label>)}</div>
        </fieldset>
      </section>

      <section className="studio-panel">
        <header><span className="studio-step">02</span><div><h2>The basics</h2><p>Your name, phone and location are needed to apply for jobs.</p></div></header>
        <div className="studio-grid">
          <label>Full name<input required minLength={2} maxLength={120} value={profile.fullName} onChange={event => update("fullName", event.target.value)} autoComplete="name" /></label>
          <label><span className="studio-label">Headline <em>Optional</em></span><input maxLength={100} value={profile.headline} onChange={event => update("headline", event.target.value)} placeholder="e.g. Head barista and latte art trainer" /><span>{profile.headline.length} / 100</span></label>
          <label>Mobile number<input type="tel" required pattern={"\\+254[17][0-9]{8}"} value={profile.phone} onChange={event => update("phone", event.target.value)} placeholder="+254712345678" autoComplete="tel" /><span>Use +254 followed by your number. Only recruiters you apply to see it.</span></label>
          <label>Location<input required minLength={2} maxLength={120} value={profile.location} onChange={event => update("location", event.target.value)} placeholder="e.g. Nairobi, Westlands" autoComplete="address-level2" /></label>
          <label>Experience in coffee<select value={profile.experienceYears == null ? "" : String(profile.experienceYears)} onChange={event => update("experienceYears", event.target.value === "" ? null : Number(event.target.value))}>{yearOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>
      </section>

      <section className="studio-panel">
        <header><span className="studio-step">03</span><div><h2>About you</h2><p>Where you've worked, what you love making, and what you're looking for next.</p></div></header>
        <label className="studio-wide"><span className="studio-label">Your story <em>Optional</em></span><textarea rows={6} maxLength={3000} value={profile.summary} onChange={event => update("summary", event.target.value)} placeholder="e.g. Five years behind the bar at busy Nairobi cafés. I train new baristas, dial in espresso every morning and love competing in latte art throwdowns." /><span>{profile.summary.length.toLocaleString()} / 3,000{profile.summary.trim().length < 80 ? " · a few sentences make a big difference" : ""}</span></label>
      </section>

      <section className="studio-panel">
        <header><span className="studio-step">04</span><div><h2>Skills</h2><p>Pick up to {MAX_SKILLS}. They show as tags on your card.</p></div><span className="studio-count">{profile.skills.length} / {MAX_SKILLS}</span></header>
        <div className="studio-skills" role="group" aria-label="Suggested skills">{[...suggestedSkills, ...profile.skills.filter(skill => !suggestedSkills.some(item => item.toLowerCase() === skill.toLowerCase()))].map(skill => {
          const on = profile.skills.some(item => item.toLowerCase() === skill.toLowerCase());
          return <button type="button" key={skill} aria-pressed={on} className={on ? "is-on" : ""} onClick={() => toggleSkill(skill)}>{on ? "✓ " : "+ "}{skill}</button>;
        })}</div>
        <div className="studio-custom"><input value={customSkill} maxLength={30} onChange={event => setCustomSkill(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addCustomSkill(); } }} placeholder="Add your own, e.g. Siphon brewing" aria-label="Add your own skill" /><button type="button" className="studio-button is-light" onClick={addCustomSkill} disabled={!customSkill.trim()}>Add</button></div>
      </section>

      <section className="studio-panel">
        <header><span className="studio-step">05</span><div><h2>Availability and links</h2><p>Let recruiters know you're looking, and where to see your work.</p></div></header>
        <label className="studio-switch"><input type="checkbox" checked={profile.openToWork} onChange={event => update("openToWork", event.target.checked)} /><span aria-hidden="true" /><div><strong>Open to work</strong><small>Shows an "Open to work" ribbon on your card.</small></div></label>
        <div className="studio-grid">
          <label><span className="studio-label">Instagram <em>Optional</em></span><input maxLength={200} value={profile.instagram} onChange={event => update("instagram", event.target.value)} placeholder="@yourhandle" /></label>
          <label><span className="studio-label">LinkedIn <em>Optional</em></span><input maxLength={200} value={profile.linkedin} onChange={event => update("linkedin", event.target.value)} placeholder="linkedin.com/in/yourname" /></label>
          <label className="studio-wide"><span className="studio-label">Website or portfolio <em>Optional</em></span><input maxLength={200} value={profile.website} onChange={event => update("website", event.target.value)} placeholder="e.g. yourcafe.co.ke" /></label>
        </div>
      </section>

      <div className={`studio-savebar${dirty ? " is-dirty" : ""}`}>
        {message ? <p role={message.error ? "alert" : "status"} className={message.error ? "is-error" : "is-ok"}>{message.text}</p> : <p>{dirty ? "You have unsaved changes." : "All changes saved."}</p>}
        <button className="studio-button" disabled={saving || !dirty}>{saving ? "Saving…" : "Save profile"}</button>
      </div>
    </form>

    <aside className="studio-side" aria-label="Preview">
      <p className="studio-side-label">How recruiters see you</p>
      <ProfileCard data={card} preview />
      <section className="studio-progress" aria-label="Profile strength">
        <div className="studio-ring" style={{ background: `conic-gradient(#0b766d ${score * 3.6}deg, #ece4d8 0deg)` }}><span>{score}%</span></div>
        <div><strong>{score === 100 ? "Your profile is complete" : score >= 70 ? "Almost there" : "Make your profile stand out"}</strong>
          <ul>{checklist.map(item => <li key={item.label} className={item.done ? "is-done" : ""}>{item.label}</li>)}</ul></div>
      </section>
    </aside>
  </div>;
}

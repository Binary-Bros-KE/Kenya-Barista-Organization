"use client";
import { useRef } from "react";
import { contactInfo, socialLinks } from "@/content/site-brand";
import { SocialMark } from "./legacy-social-mark";

const social = Object.fromEntries(socialLinks);
const phoneDisplay = "0" + contactInfo.phone.slice(4).replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
const PhoneIcon = ({ size = 22 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>;
const channels: { name: string; detail: string; href: string; icon: React.ReactNode; external?: boolean }[] = [
 { name: "WhatsApp", detail: "KBO team · " + phoneDisplay, href: "https://wa.me/" + contactInfo.phone.slice(1), external: true, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="#25d366" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1.1 2.7 11.5 11.5 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3z"/></svg> },
 { name: "Call us", detail: phoneDisplay, href: "tel:" + contactInfo.phone, icon: <PhoneIcon size={19}/> },
 { name: "Email", detail: contactInfo.email, href: "mailto:" + contactInfo.email, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3.5 6 8.5 7 8.5-7"/></svg> },
 { name: "Instagram", detail: "@kenya_barista_organization", href: social.Instagram, external: true, icon: <span style={{ color: "#d6336c", display: "flex" }}><SocialMark name="Instagram"/></span> },
 { name: "Facebook", detail: "Kenya Barista Organization", href: social.Facebook, external: true, icon: <span style={{ color: "#1877f2", display: "flex" }}><SocialMark name="Facebook"/></span> },
];

export function ContactFloat() {
 const dialog = useRef<HTMLDialogElement>(null);
 return <>
  <button type="button" className="contact-float" aria-label="Contact KBO" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}><PhoneIcon/></button>
  <dialog ref={dialog} className="contact-float-dialog" aria-labelledby="contact-float-title" onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
   <div className="contact-float-panel">
    <header><div><span className="contact-float-eyebrow">KENYA BARISTA ORGANIZATION</span><h2 id="contact-float-title">Talk to KBO</h2></div><button type="button" className="contact-float-close" aria-label="Close" onClick={() => dialog.current?.close()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
    <p>Questions about courses, jobs or membership? Choose a channel below. It opens in that app, and you decide when to send your message.</p>
    <ul>{channels.map((c) => <li key={c.name}><a href={c.href} {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}><span className="contact-float-icon">{c.icon}</span><span><strong>{c.name}</strong><small>{c.detail}</small></span><span className="contact-float-arrow" aria-hidden="true">↗</span></a></li>)}</ul>
   </div>
  </dialog>
 </>;
}

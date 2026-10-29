"use client";
import { useState } from "react";
const email = "info@kenyabaristaorg.co.ke";
export function LegacyEnquiry({ course = false }: { course?: boolean }) {
  const [message, setMessage] = useState("");
  return <form className="legacy-enquiry form-stack" onSubmit={event => {
    event.preventDefault(); const fields = new FormData(event.currentTarget), lines: string[] = [];
    fields.forEach((value, key) => lines.push(`${key}: ${String(value)}`));
    const subject = course ? `Course registration enquiry: ${fields.get("Course Taken")}` : String(fields.get("Subject") || "Contact enquiry");
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    setMessage("Your email app has been requested. Review the draft and send it to complete your enquiry. Nothing has been submitted on this site.");
  }}><h2 className="text-center">{course ? "Register and Join Us" : "Contact Us"}</h2>
    {course ? <div className="legacy-form-row"><label>First Name<input name="First Name" required maxLength={120} autoComplete="given-name" /></label><label>Last Name<input name="Last Name" required maxLength={120} autoComplete="family-name" /></label></div> : <label>Name*<input name="Name" required maxLength={120} autoComplete="name" /></label>}
    <label>Email Address*<input name="Email Address" required type="email" maxLength={254} autoComplete="email" /></label>
    {course ? <><label>Phone Number<input name="Phone Number" required type="tel" maxLength={30} autoComplete="tel" /></label><label>Gender<select name="Gender"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></label><label>Nationality<input name="Nationality" maxLength={120} /></label><label>Age<input name="Age" type="number" min={1} max={120} /></label><label>Course Taken<select name="Course Taken" required><option value="">Select a course</option><option>Barista Course</option><option>Roasting Course</option></select></label></> : <><label>Subject*<input name="Subject" required maxLength={160} /></label><label>Message Content*<textarea name="Message" required rows={6} maxLength={3000} /></label></>}
    <p className="hint">This opens an email draft to {email}. Send the email from your email app. {course && "The organisation will confirm course availability and registration details."}</p><button className="button" type="submit">{course ? "Email registration enquiry" : "Prepare email"}</button><p role="status">{message}</p>
  </form>;
}

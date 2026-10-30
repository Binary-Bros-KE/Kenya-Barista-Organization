import { contactInfo } from "../content/site-brand";
export function enquiryDraft(fields: [string, string][], course: boolean) {
 const values = Object.fromEntries(fields);
 const subject = course ? "Course registration enquiry: "+(values["Course Taken"]||"") : values.Subject || "Contact enquiry";
 const body = fields.map(([key,value])=>key+": "+value).join(String.fromCharCode(10));
 return "mailto:"+contactInfo.email+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
}

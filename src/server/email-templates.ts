// Branded transactional emails. Built with tables and inline styles so they render in Gmail, Outlook and phones,
// and always paired with a plain-text version. Every value from users is escaped.

type Email = { subject: string; text: string; html: string };
type Row = [label: string, value: string];

const colors = { green: "#263d2d", deep: "#1b2c20", gold: "#e0b766", cream: "#f7f3e9", paper: "#fffdf8", ink: "#30271e", muted: "#736553", line: "#e7dfd5", teal: "#0b766d" };
const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const serif = "Georgia, 'Times New Roman', serif";

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const firstName = (name: string | null | undefined) => (name || "").trim().split(/\s+/)[0] || "there";

function layout({ baseUrl, preheader, eyebrow, title, intro, rows, steps, stepsTitle = "What happens next", badge, button, footnote }: {
  baseUrl: string; preheader: string; eyebrow: string; title: string; intro: string[];
  rows?: Row[]; steps?: [string, string][]; stepsTitle?: string; badge?: boolean; button: { label: string; href: string }; footnote: string;
}) {
  const url = (path: string) => new URL(path, baseUrl).toString();
  const paragraphs = intro.map(text => `<p style="margin:0 0 14px;font:16px/1.7 ${font};color:${colors.ink}">${text}</p>`).join("");
  const summary = rows?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;border:1px solid ${colors.line};border-radius:12px;background:${colors.cream}">
    ${rows.map(([label, value], index) => `<tr><td style="padding:12px 18px;${index ? `border-top:1px solid ${colors.line};` : ""}font:12px/1.4 ${font};letter-spacing:.6px;text-transform:uppercase;color:${colors.muted};width:34%;vertical-align:top">${escape(label)}</td><td style="padding:12px 18px;${index ? `border-top:1px solid ${colors.line};` : ""}font:15px/1.5 ${font};color:${colors.ink};font-weight:600">${escape(value)}</td></tr>`).join("")}
  </table>` : "";
  const verified = badge ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 22px"><tr><td style="background:#e3f4f1;border-radius:999px;padding:8px 16px 8px 10px;font:700 14px/1 ${font};color:${colors.teal}">
    <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${colors.teal};color:#fff;text-align:center;font:700 13px/22px ${font};margin-right:8px">&#10003;</span>Verified recruiter</td></tr></table>` : "";
  const next = steps?.length ? `<p style="margin:8px 0 12px;font:700 13px/1.4 ${font};letter-spacing:1.2px;text-transform:uppercase;color:${colors.muted}">${escape(stepsTitle)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">${steps.map(([heading, body], index) => `<tr><td style="width:40px;vertical-align:top;padding:0 0 14px"><div style="width:28px;height:28px;border-radius:50%;background:${colors.green};color:${colors.gold};text-align:center;font:700 13px/28px ${font}">${index + 1}</div></td>
      <td style="vertical-align:top;padding:2px 0 14px"><div style="font:700 15px/1.4 ${font};color:${colors.ink}">${heading}</div><div style="font:14px/1.6 ${font};color:${colors.muted}">${body}</div></td></tr>`).join("")}</table>` : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:${colors.cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.cream}"><tr><td align="center" style="padding:28px 14px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
    <tr><td style="background:${colors.green};border-radius:16px 16px 0 0;padding:22px 28px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px"><img src="${url("/brand-logo.png")}" width="44" height="44" alt="" style="display:block;border-radius:50%;background:#fff"></td>
        <td><div style="font:400 20px/1.2 ${serif};color:#fff">Kenya Barista</div><div style="font:600 10px/1.6 ${font};letter-spacing:2px;color:${colors.gold}">ORGANIZATION</div></td>
      </tr></table>
    </td></tr>
    <tr><td style="height:4px;background:${colors.gold};line-height:4px;font-size:0">&nbsp;</td></tr>
    <tr><td style="background:${colors.paper};padding:34px 32px 30px;border:1px solid ${colors.line};border-top:0;border-radius:0 0 16px 16px">
      <p style="margin:0 0 10px;font:700 12px/1.4 ${font};letter-spacing:1.6px;text-transform:uppercase;color:#8a6a2f">${escape(eyebrow)}</p>
      <h1 style="margin:0 0 18px;font:400 30px/1.2 ${serif};color:${colors.green}">${escape(title)}</h1>
      ${verified}${paragraphs}${summary}${next}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 26px"><tr><td style="border-radius:12px;background:${colors.green}">
        <a href="${url(button.href)}" style="display:inline-block;padding:14px 26px;font:700 15px/1 ${font};color:#fff;text-decoration:none;border-radius:12px">${escape(button.label)} &rarr;</a>
      </td></tr></table>
      <p style="margin:0;padding-top:18px;border-top:1px solid ${colors.line};font:13px/1.7 ${font};color:${colors.muted}">${footnote}</p>
    </td></tr>
    <tr><td style="padding:20px 10px 0;text-align:center;font:12px/1.7 ${font};color:${colors.muted}">
      Kenya Barista Organization &middot; Nairobi, Kenya<br>
      <a href="${url("/contact")}" style="color:${colors.muted}">Contact KBO</a> &middot; <a href="${url("/jobs")}" style="color:${colors.muted}">Coffee jobs</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
  return html;
}

function plain(lines: (string | false | undefined)[]) { return lines.filter((line): line is string => line !== false && line !== undefined).join("\n"); }

export function recruiterRequestReceivedEmail({ baseUrl, name, hiringFor, roles, phone, location }: { baseUrl: string; name: string | null; hiringFor: string; roles: string; phone: string; location: string }): Email {
  const hello = escape(firstName(name));
  const subject = "We've received your recruiter request";
  const steps: [string, string][] = [
    ["We review your request", "Our team reads every request, usually within two working days."],
    ["We may call you", `If we need to confirm anything, we'll call or message ${escape(phone)}.`],
    ["You hear back by email", "Once approved, you can post jobs and review applicants straight away."],
  ];
  return {
    subject,
    html: layout({
      baseUrl, preheader: "Thanks for asking to recruit on KBO. Here's what happens next.", eyebrow: "Recruiter request received", title: "Thank you, we've got your request",
      intro: [`Hi ${hello},`, "Thanks for asking to hire through the Kenya Barista Organization. Your request is now waiting for our team to review. Here is what you sent us:"],
      rows: [["Hiring for", hiringFor], ["Roles", roles], ["Phone", phone], ["Location", location]],
      steps, button: { label: "View your request", href: "/dashboard/recruiter-request" },
      footnote: "You can withdraw your request from your dashboard while it's waiting. If you didn't ask to become a recruiter, you can ignore this email.",
    }),
    text: plain([`Hi ${firstName(name)},`, "", "Thanks for asking to hire through the Kenya Barista Organization. Your recruiter request is waiting for our team to review.", "",
      `Hiring for: ${hiringFor}`, `Roles: ${roles}`, `Phone: ${phone}`, `Location: ${location}`, "",
      "What happens next:", "1. We review your request, usually within two working days.", `2. If we need to confirm anything, we'll call or message ${phone}.`, "3. Once approved, you can post jobs and review applicants straight away.", "",
      `View your request: ${new URL("/dashboard/recruiter-request", baseUrl)}`, "", "Kenya Barista Organization"]),
  };
}

export function recruiterApprovedEmail({ baseUrl, name, note }: { baseUrl: string; name: string | null; note?: string | null }): Email {
  const hello = escape(firstName(name));
  const subject = "You're now a recruiter on KBO";
  return {
    subject,
    html: layout({
      baseUrl, preheader: "Your recruiter request was approved. Post your first job today.", eyebrow: "Request approved", title: "Welcome aboard, you're a recruiter",
      intro: [`Hi ${hello},`, "Good news: your request was approved. Your KBO account is now a recruiter account, so you can post coffee and hospitality jobs and review the people who apply.", ...(note ? [`A note from our team: <em>&ldquo;${escape(note)}&rdquo;</em>`] : [])],
      steps: [
        ["Post your first job", "Describe the role, location and deadline. KBO checks each posting before it goes live."],
        ["Review applicants", "Paid applications arrive in your dashboard with each person's profile and CV."],
        ["Get verified", "Once we've confirmed your details, your jobs show a Verified badge that job seekers trust."],
      ],
      button: { label: "Post your first job", href: "/employer/jobs/new" },
      footnote: "Your job seeker profile and applications stay exactly as they were. Questions? Reply to this email or contact KBO from the website.",
    }),
    text: plain([`Hi ${firstName(name)},`, "", "Good news: your recruiter request was approved. Your KBO account can now post jobs and review applicants.", note ? `\nA note from our team: "${note}"` : undefined, "",
      "Next steps:", "1. Post your first job. KBO checks each posting before it goes live.", "2. Review applicants in your dashboard.", "3. Get verified: once we've confirmed your details, your jobs show a Verified badge.", "",
      `Post your first job: ${new URL("/employer/jobs/new", baseUrl)}`, "", "Kenya Barista Organization"]),
  };
}

export function recruiterRejectedEmail({ baseUrl, name, reason }: { baseUrl: string; name: string | null; reason: string }): Email {
  const hello = escape(firstName(name));
  const subject = "Your KBO recruiter request was rejected";
  return {
    subject,
    html: layout({
      baseUrl, preheader: `Reason: ${reason.length > 110 ? `${reason.slice(0, 107)}...` : reason} · You can update your details and apply again.`, eyebrow: "Request rejected", title: "Your recruiter request was rejected",
      intro: [`Hi ${hello},`, "Thank you for asking to recruit through the Kenya Barista Organization. We've reviewed your request and couldn't approve it this time."],
      rows: [["Reason", reason]],
      stepsTitle: "What you can do",
      steps: [
        ["Check the reason above", "It tells you what we couldn't confirm, such as a phone number we couldn't reach."],
        ["Apply again", "Update your details from your dashboard and send a new request whenever you're ready."],
      ],
      button: { label: "Apply again", href: "/dashboard/recruiter-request" },
      footnote: "Your job seeker account isn't affected: your profile, CVs and applications stay exactly as they were. Questions? Contact KBO from the website.",
    }),
    text: plain([`Hi ${firstName(name)},`, "", "Thank you for asking to recruit through the Kenya Barista Organization. We've reviewed your request and couldn't approve it this time.", "",
      `Reason: ${reason}`, "", "You can update your details and apply again from your dashboard whenever you're ready. Your job seeker account isn't affected.", "",
      `Apply again: ${new URL("/dashboard/recruiter-request", baseUrl)}`, "", "Kenya Barista Organization"]),
  };
}

export function recruiterVerifiedEmail({ baseUrl, name }: { baseUrl: string; name: string | null }): Email {
  const hello = escape(firstName(name));
  const subject = "You're a verified recruiter on KBO";
  return {
    subject,
    html: layout({
      baseUrl, preheader: "Your jobs now carry the KBO Verified badge.", eyebrow: "Verification complete", title: "You're verified",
      intro: [`Hi ${hello},`, "We've confirmed your contact details and who you hire for. From today, every job you post on KBO carries the <strong>Verified</strong> badge, so baristas know your opportunity is genuine."],
      badge: true, stepsTitle: "Good to know",
      steps: [
        ["Your badge is live", "It shows on your job listings, job pages and your dashboard, including jobs you've already posted."],
        ["Keep your details current", "If your phone number or business changes, let us know so your badge stays accurate."],
      ],
      button: { label: "Open your dashboard", href: "/dashboard" },
      footnote: "Verification is reviewed from time to time. If anything changes, KBO may contact you to confirm your details again.",
    }),
    text: plain([`Hi ${firstName(name)},`, "", "We've confirmed your details. From today, every job you post on KBO carries the Verified badge, so baristas know your opportunity is genuine.", "",
      "The badge shows on your job listings, job pages and dashboard, including jobs you've already posted.", "If your phone number or business changes, let us know so your badge stays accurate.", "",
      `Open your dashboard: ${new URL("/dashboard", baseUrl)}`, "", "Kenya Barista Organization"]),
  };
}

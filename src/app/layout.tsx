import type { Metadata } from "next";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import "./globals.css";
import "./workspace.css";
import "./overview.css";
import "./signature.css";
import "./accounts.css";
import "./recruiters.css";
import "./profile.css";
import "./profile-studio.css";
import "./cv-viewer.css";
import "./job-create.css";
import "./dashboard-jobs.css";
import "./wallet.css";
import "./applications.css";
import "./activity.css";
import "./security.css";
import "./employer.css";
import "./admin.css";
import "./legacy-fonts.css";
import "./legacy.css";
import "./legacy-spacing.css";
import "./site.css";
import "./content.css";
import "./careers.css";
import "./polish.css";
import "./readability.css";

export const metadata: Metadata = {
  title: { default: "Kenya Barista Organization", template: "%s | Kenya Barista Organization" },
  description: "To inspire and nurture youth in coffee skills profession. Kenya Barista Organization courses, community and coffee career opportunities.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The progress bar reads the URL, so it sits in its own Suspense boundary and never holds back the page.
  return <html lang="en"><body><Suspense fallback={null}><NavigationProgress /></Suspense>{children}</body></html>;
}

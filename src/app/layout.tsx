import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";
import "./overview.css";
import "./profile.css";
import "./applications.css";
import "./activity.css";
import "./security.css";
import "./employer.css";
import "./admin.css";
import "./legacy-fonts.css";
import "./legacy.css";
import "./legacy-spacing.css";
import "./site.css";

export const metadata: Metadata = {
  title: { default: "Kenya Barista Organization", template: "%s | Kenya Barista Organization" },
  description: "To inspire and nurture youth in coffee skills profession. Kenya Barista Organization courses, community and coffee career opportunities.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}

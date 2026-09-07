import type { Metadata } from "next";
import "./globals.css";
import "./production.css";

export const metadata: Metadata = {
  title: "Mizan | UAE Regulatory Intelligence",
  description: "Search verified UAE regulatory material and ask compliance questions against Mizan's evidence-backed regulatory database.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FGA Lens — Authorization decisions, explained",
  description: "A semantic proof debugger for relationship-based authorization.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Synex Trade Academy — Kelas Trading Terstruktur",
  description:
    "Landing page kelas trading premium dengan pendekatan edukasi, risk management, dan trading plan.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${manrope.variable} font-sans`}>{children}</body>
    </html>
  );
}

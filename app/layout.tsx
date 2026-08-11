import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Kafeinmatcha Academy",
  description:
    "Structured live online trading classes focused on market reading, risk management, and independent trading plans.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${manrope.variable} font-sans`}>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { LanguageProvider } from "@/shared/i18n/language";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DataCenter Command UI",
  description: "SCADA Control Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#010613] text-white flex flex-col h-screen overflow-hidden`}
      >
        <LanguageProvider>
          <Navbar />
          {/* min-h-0：flex 子項預設 min-height:auto，會讓 overflow 區塊高度計算異常，導致捲動/點擊失效 */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}

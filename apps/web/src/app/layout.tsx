import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@fangpian/ui/theme.css";
import "./globals.css";
import { SiteChrome } from "@/components/app-shell/site-chrome";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "方片·敢想敢成", template: "%s｜方片·敢想敢成" },
  description: "让组织的问题，找到最适合解决它的人。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><SiteChrome>{children}</SiteChrome></body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
  preload: false, // 2MB 가변 글꼴이라 미리 받지 않고, 시스템 글꼴로 먼저 그린다
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "테크라노 애널리틱스", template: "%s · 테크라노 애널리틱스" },
  description: "@tech.rano 릴스·쇼츠 성과를 15분마다 모아 2단계 관문으로 읽는 대시보드",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "테크라노", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`dark ${pretendard.variable} ${jetbrains.variable} h-full`}>
      <body className="min-h-full">
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster position="top-center" theme="dark" />
      </body>
    </html>
  );
}

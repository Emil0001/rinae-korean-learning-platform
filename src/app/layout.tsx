import type { Metadata } from "next";
import { Manrope, Noto_Sans_KR, Sora } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { AuthProvider } from "@/context/auth-context";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { RouteScrollReset } from "@/components/route-scroll-reset";
import { StyledComponentsRegistry } from "@/lib/styled-components-registry";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-ui",
  subsets: ["latin", "cyrillic"],
});

const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
});

const notoSansKR = Noto_Sans_KR({
  variable: "--font-kr",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rinae Korean",
  description: "Платформа корейского языка: уроки, курсы и подготовка к TOPIK.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${manrope.variable} ${sora.variable} ${notoSansKR.variable} antialiased`}
      >
        <StyledComponentsRegistry>
          <AuthProvider>
            <RouteScrollReset />
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
          </AuthProvider>
        </StyledComponentsRegistry>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}

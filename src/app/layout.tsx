import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { ProfileProvider } from "@/context/profile-context";
import { ThemeProvider } from "@/context/theme-context";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "نظام تتبع الشحنات | Elmaghraby Tracing",
  description: "إدارة الشحنات والاستيراد",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          <ProfileProvider>
            <AppShell>{children}</AppShell>
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

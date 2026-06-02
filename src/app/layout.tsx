import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Cairo } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { LanguageProvider } from "@/context/language-context";
import { ProfileProvider } from "@/context/profile-context";
import { ThemeProvider } from "@/context/theme-context";
import type { AppLanguage } from "@/lib/i18n";
import { DEFAULT_LANGUAGE, languageToDir } from "@/lib/i18n";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("app_lang")?.value;
  const initialLanguage: AppLanguage = cookieLang === "en" || cookieLang === "ar" ? cookieLang : DEFAULT_LANGUAGE;
  const initialDir = languageToDir(initialLanguage);

  return (
    <html lang={initialLanguage} dir={initialDir} className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          <LanguageProvider initialLanguage={initialLanguage}>
            <ProfileProvider>
              <AppShell>{children}</AppShell>
            </ProfileProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

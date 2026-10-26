import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

import { LocaleProvider } from "@/components/locale-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { getLocale } from "@/lib/locale.server";

import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const themeScript = `(function(){try{var t=localStorage.getItem('mp_theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export const metadata: Metadata = {
  title: {
    default: "MyPhoto Mada — Photobooks personnalisés à Madagascar",
    template: "%s · MyPhoto Mada",
  },
  description:
    "Créez votre photobook en ligne en A4, A5, A6 ou carré : 20 pages minimum à 15 000 Ar, puis 1 000 Ar par page. Payez par MVola ou Orange Money, impression 300 dpi à Antananarivo.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={jetbrainsMono.variable}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <LocaleProvider locale={locale}>{children}</LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

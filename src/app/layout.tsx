import type { Metadata } from "next";

import { LocaleProvider } from "@/components/locale-provider";
import { getLocale } from "@/lib/locale.server";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MyPhoto Mada — Impression photo et création en ligne à Madagascar",
    template: "%s · MyPhoto Mada",
  },
  description:
    "Tirages photo, cadres, albums, mugs et t-shirts personnalisés. Créez en ligne dans notre atelier, payez par MVola, Orange Money ou à la livraison, partout à Madagascar.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-sand-50 text-ink-900 antialiased">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}

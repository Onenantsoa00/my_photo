import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getLocale } from "@/lib/locale.server";

export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader locale={locale} />
      <main className="flex-1">{children}</main>
      <SiteFooter locale={locale} />
    </div>
  );
}

"use client";

import {
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  ShoppingBag,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Locale } from "@/lib/i18n";

import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  NotificationBell,
  type NotificationItem,
} from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { useT } from "@/components/locale-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { signOutAction } from "@/server/actions/auth";

export type HeaderLink = {
  href: string;
  label: string;
  primary?: boolean;
};

export type HeaderUser = {
  name: string;
  role: "CUSTOMER" | "ADMIN";
} | null;

export function SiteHeaderShell({
  links,
  user,
  cartCount,
  notifications,
  locale,
}: {
  links: HeaderLink[];
  user: HeaderUser;
  cartCount: number;
  notifications: NotificationItem[];
  locale: Locale;
}) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const signOut = () => {
    startTransition(async () => {
      await signOutAction();
    });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-sand-200 bg-card/90 backdrop-blur-xl supports-[backdrop-filter]:bg-card/75">
      <div className="container-page flex h-16 items-center gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-lg font-black text-white shadow-md shadow-brand-700/25">
            M
          </span>
          <span className="text-base font-extrabold tracking-tight">
            MyPhoto<span className="text-brand-600">Mada</span>
          </span>
        </Link>

        <nav className="ml-4 hidden min-w-0 flex-1 items-center gap-1 lg:flex">
          {links.map((link) =>
            link.primary ? (
              <Link
                key={link.href}
                href={link.href}
                className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-brand-600/25 transition hover:brightness-110"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive(link.href)
                    ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100"
                    : "text-ink-700 hover:bg-sand-100 hover:text-ink-900"
                }`}
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden sm:block">
            <LocaleSwitcher locale={locale} />
          </div>

          <NotificationBell items={notifications} />

          <ThemeToggle />

          <Link
            href="/panier"
            className="relative grid h-9 w-9 place-items-center rounded-xl border border-sand-300 bg-card text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-700"
            aria-label={t("nav.cart")}
            title={t("nav.cart")}
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white ring-2 ring-card">
                {cartCount}
              </span>
            ) : null}
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="hidden h-9 items-center gap-2 rounded-xl border border-sand-300 bg-card px-2.5 text-sm font-semibold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-700 sm:inline-flex"
                aria-label={t("nav.myAccount")}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-100 text-[10px] font-black text-brand-700 dark:bg-brand-900 dark:text-brand-100">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-24 truncate">{user.name.split(" ")[0]}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl p-1">
                <DropdownMenuLabel className="truncate">{user.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer gap-2 rounded-lg px-2 py-2"
                  onClick={() => router.push("/compte")}
                >
                  <UserRound className="h-4 w-4 text-ink-500" />
                  {t("nav.account")}
                </DropdownMenuItem>
                {user.role === "ADMIN" ? (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 rounded-lg px-2 py-2"
                    onClick={() => router.push("/admin")}
                  >
                    <LayoutDashboard className="h-4 w-4 text-ink-500" />
                    {t("nav.admin")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer gap-2 rounded-lg px-2 py-2 text-accent-600"
                  onClick={signOut}
                  disabled={isPending}
                >
                  <LogOut className="h-4 w-4" />
                  {t("nav.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/connexion"
              className="hidden items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white shadow-sm shadow-brand-600/20 transition hover:brightness-110 sm:inline-flex"
            >
              <LogIn className="h-3.5 w-3.5" />
              {t("nav.signIn")}
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-sand-300 bg-card text-ink-700 lg:hidden"
            aria-label={t("nav.menu")}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[20rem] max-w-[85vw] p-0">
          <SheetHeader className="border-b border-sand-200 p-5">
            <SheetTitle className="flex items-center gap-2 text-base font-extrabold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 text-sm font-black text-white">
                M
              </span>
              MyPhoto Mada
            </SheetTitle>
            <SheetDescription>{t("common.tagline")}</SheetDescription>
          </SheetHeader>

          <nav className="space-y-1 p-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  isActive(link.href)
                    ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100"
                    : "text-ink-700 hover:bg-sand-100"
                }`}
              >
                {link.primary ? <Sparkles className="h-4 w-4 text-brand-600" /> : null}
                {link.label}
              </Link>
            ))}

            <Link
              href="/panier"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-sand-100"
            >
              <ShoppingBag className="h-4 w-4" />
              {t("nav.cart")}
              {cartCount > 0 ? (
                <span className="ml-auto rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              ) : null}
            </Link>

            {user ? (
              <>
                <Link
                  href="/compte"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-sand-100"
                >
                  <UserRound className="h-4 w-4" />
                  {t("nav.account")}
                </Link>
                {user.role === "ADMIN" ? (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-sand-100"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {t("nav.admin")}
                  </Link>
                ) : null}
              </>
            ) : (
              <Link
                href="/connexion"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-brand-900/30"
              >
                <LogIn className="h-4 w-4" />
                {t("nav.signIn")}
              </Link>
            )}
          </nav>

          <div className="mt-2 border-t border-sand-200 p-4">
            <LocaleSwitcher locale={locale} />
          </div>

          {user ? (
            <div className="mt-auto border-t border-sand-200 p-4">
              <button
                type="button"
                onClick={signOut}
                disabled={isPending}
                className="btn-outline w-full justify-start gap-2 text-accent-600"
              >
                <LogOut className="h-4 w-4" />
                {t("nav.signOut")}
              </button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </header>
  );
}

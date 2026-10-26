import {
  ArrowRight,
  BookOpen,
  Check,
  Heart,
  ImagePlus,
  LayoutTemplate,
  MoonStar,
  Palette,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import Link from "next/link";

import { TemplatePreview } from "@/components/editor/template-preview";
import { FadeIn, Reveal } from "@/components/motion/reveal";
import { PriceTeaser } from "@/components/photobook/price-teaser";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { PAYMENT_ACCOUNTS, PAYMENT_ACCOUNT_NAME } from "@/lib/payment";
import {
  PHOTOBOOK_BASE_PRICE_MGA,
  PHOTOBOOK_EXTRA_PAGE_MGA,
  PHOTOBOOK_MIN_PAGES,
} from "@/lib/photobook";
import { findTemplate, type Template } from "@/lib/editor/templates";

export default async function HomePage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const cover = findTemplate("pb-couverture")?.build();
  const gallery = ["pb-mariage", "pb-grille-4", "pb-voyage", "pb-bebe"]
    .map((id) => findTemplate(id))
    .filter((template): template is Template => Boolean(template))
    .map((template) => ({
      template,
      document: template.build(),
    }));

  const features = [
    { icon: BookOpen, title: t("home.feature1Title"), text: t("home.feature1Text") },
    { icon: ShieldCheck, title: t("home.feature2Title"), text: t("home.feature2Text") },
    { icon: Heart, title: t("home.feature3Title"), text: t("home.feature3Text") },
    { icon: LayoutTemplate, title: t("home.feature4Title"), text: t("home.feature4Text") },
    { icon: Smartphone, title: t("home.feature5Title"), text: t("home.feature5Text") },
    { icon: MoonStar, title: t("home.feature6Title"), text: t("home.feature6Text") },
  ];

  const steps = [
    { title: t("home.howStep1Title"), text: t("home.howStep1Text") },
    { title: t("home.howStep2Title"), text: t("home.howStep2Text") },
    { title: t("home.howStep3Title"), text: t("home.howStep3Text") },
  ];

  return (
    <div>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden bg-[#061310] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-accent-500/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="container-page relative grid gap-14 py-14 sm:py-20 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:py-24">
          <FadeIn>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-brand-200 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              {t("home.heroBadge")}
            </span>

            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
              {t("home.heroTitle")}
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              {t("home.heroSubtitle")}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/creer"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-900/40 transition hover:brightness-110"
              >
                <BookOpen className="h-4 w-4" />
                {t("home.heroCta")}
              </Link>
              <Link
                href="/produits/photobook"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
              >
                {t("home.heroSecondary")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-300">
              {[t("home.heroProof1"), t("home.heroProof2"), t("home.heroProof3")].map(
                (proof) => (
                  <li key={proof} className="flex items-center gap-1.5">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-500/20 text-brand-300">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                    {proof}
                  </li>
                ),
              )}
            </ul>
          </FadeIn>

          {/* Aperçu du photobook */}
          <FadeIn delay={0.12} className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative h-[22rem] sm:h-[27rem]">
              <div className="absolute left-[6%] top-[8%] w-[58%] rotate-[-7deg] rounded-xl shadow-2xl shadow-black/40 transition-transform duration-500 hover:rotate-[-3deg]">
                {cover ? <TemplatePreview document={cover} width={260} /> : null}
              </div>
              <div className="absolute right-[4%] top-[22%] w-[55%] rotate-[6deg] rounded-xl shadow-2xl shadow-black/50 transition-transform duration-500 hover:rotate-[3deg]">
                {gallery[0] ? <TemplatePreview document={gallery[0].document} width={250} /> : null}
              </div>
              <div className="absolute bottom-[2%] left-[22%] w-[52%] rotate-[2deg] rounded-xl shadow-2xl shadow-black/40">
                {gallery[2] ? <TemplatePreview document={gallery[2].document} width={240} /> : null}
              </div>

              <div className="absolute -bottom-2 right-0 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-right backdrop-blur-md sm:right-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-200">
                  A4 · A5 · A6 · Carré
                </p>
                <p className="mt-0.5 text-xl font-black text-white">
                  {new Intl.NumberFormat("fr-MG").format(PHOTOBOOK_BASE_PRICE_MGA)} Ar
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ------------------------------------------------------------ Arguments */}
      <section className="container-page py-16 sm:py-20">
        <Reveal className="max-w-2xl">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
            MyPhoto Studio
          </span>
          <h2 className="section-title mt-2 text-3xl sm:text-4xl">{t("home.featuresTitle")}</h2>
          <p className="muted mt-3 text-base leading-relaxed">{t("home.featuresSubtitle")}</p>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.04}>
              <div className="card h-full p-5 transition-shadow hover:shadow-md">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200/60 dark:bg-brand-900/40 dark:text-brand-200 dark:ring-brand-800">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-bold">{feature.title}</h3>
                <p className="muted mt-1 text-sm leading-relaxed">{feature.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ Modèles */}
      <section className="border-y border-sand-200 bg-card py-16 sm:py-20">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Reveal className="max-w-xl">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
                {t("editor.templates")}
              </span>
              <h2 className="section-title mt-2 text-3xl sm:text-4xl">
                {t("home.templatesTitle")}
              </h2>
              <p className="muted mt-3 text-base">{t("home.templatesSubtitle")}</p>
            </Reveal>
            <Link
              href="/creer"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline dark:text-brand-300"
            >
              {t("editor.templates")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {gallery.map(({ template, document }, index) => (
              <Reveal key={template.id} delay={index * 0.05}>
                <article className="group card overflow-hidden p-3 transition-shadow hover:shadow-md">
                  <div className="flex justify-center overflow-hidden rounded-xl bg-sand-100 p-3">
                    <TemplatePreview document={document} width={190} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold">
                        {locale === "mg" ? template.nameMg : template.nameFr}
                      </h3>
                      <p className="muted truncate text-xs">
                        {locale === "mg"
                          ? (template.descriptionMg ?? template.descriptionFr)
                          : template.descriptionFr}
                      </p>
                    </div>
                    <Palette className="h-4 w-4 shrink-0 text-brand-500" />
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Prix */}
      <section id="prix" className="container-page py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_26rem] lg:items-center">
          <Reveal>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
              {t("wizard.price")}
            </span>
            <h2 className="section-title mt-2 text-3xl sm:text-4xl">{t("home.pricingTitle")}</h2>
            <p className="muted mt-3 max-w-xl text-base leading-relaxed">
              {t("home.pricingSubtitle")}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-800 dark:bg-brand-900/30">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-200">
                  {PHOTOBOOK_MIN_PAGES} {t("editor.pagesShort")}
                </p>
                <p className="mt-2 text-3xl font-black text-brand-800 dark:text-brand-100">
                  {new Intl.NumberFormat("fr-MG").format(PHOTOBOOK_BASE_PRICE_MGA)} Ar
                </p>
                <p className="mt-1 text-xs text-ink-500">A4, A5, A6 ou carré · impression 300 dpi</p>
              </div>
              <div className="rounded-2xl border border-sand-200 bg-card p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-500">
                  {t("wizard.extraPages")}
                </p>
                <p className="mt-2 text-3xl font-black text-ink-900">
                  + {new Intl.NumberFormat("fr-MG").format(PHOTOBOOK_EXTRA_PAGE_MGA)} Ar
                </p>
                <p className="mt-1 text-xs text-ink-500">par page supplémentaire</p>
              </div>
            </div>

            <ul className="mt-6 space-y-2 text-sm text-ink-700">
              {[
                "Prix recalculé automatiquement quand vous ajoutez une page",
                "Brouillon enregistré et reprise plus tard",
                "Aucun paiement en ligne : transfert Mobile Money simple",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.08}>
            <PriceTeaser />
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------- Paiement */}
      <section className="relative overflow-hidden bg-[#061310] py-16 text-white sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl"
        />
        <div className="container-page relative grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-brand-200">
              <Smartphone className="h-3.5 w-3.5" /> Mobile Money
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              {t("home.paymentTitle")}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-300">
              {t("home.paymentText")}
            </p>
            <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-300">
              <ShieldCheck className="h-4 w-4 text-brand-300" />
              {t("home.paymentTrust")}
            </p>
          </Reveal>

          <Reveal delay={0.08} className="space-y-3">
            {(
              [
                { key: "MVOLA", accent: "bg-yellow-400 text-yellow-950", badge: "MV" },
                { key: "ORANGE_MONEY", accent: "bg-orange-500 text-white", badge: "OM" },
              ] as const
            ).map(({ key, accent, badge }) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur"
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xs font-black ${accent}`}
                >
                  {badge}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {PAYMENT_ACCOUNTS[key].labelFr}
                  </p>
                  <p className="font-mono text-lg font-black tracking-wide">
                    {PAYMENT_ACCOUNTS[key].number}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
                    {PAYMENT_ACCOUNT_NAME}
                  </p>
                </div>
                <Star className="h-4 w-4 shrink-0 text-brand-300" />
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------- Comment ça marche */}
      <section className="container-page py-16 sm:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="section-title text-3xl sm:text-4xl">{t("home.howTitle")}</h2>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.06}>
              <div className="card h-full p-6">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-sm font-black text-white shadow-md shadow-brand-600/25">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-bold">{step.title}</h3>
                <p className="muted mt-1 text-sm leading-relaxed">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- CTA final */}
      <section className="container-page pb-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-6 py-12 text-center text-white shadow-2xl shadow-brand-900/20 sm:px-12 sm:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-accent-400/20 blur-3xl"
            />
            <div className="relative">
              <ImagePlus className="mx-auto h-8 w-8 text-brand-100" />
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                {t("home.finalTitle")}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-50">
                {t("home.finalText")}
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link
                  href="/creer"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-black text-brand-800 transition hover:bg-brand-50"
                >
                  <BookOpen className="h-4 w-4" />
                  {t("home.finalCta")}
                </Link>
                <Link
                  href="/produits/photobook"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  <Truck className="h-4 w-4" />
                  {t("home.heroSecondary")}
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

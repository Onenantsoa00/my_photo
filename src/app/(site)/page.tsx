import {
  ArrowRight,
  BookOpen,
  Camera,
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
import { Stars } from "@/components/reviews/stars";
import {
  backgroundToCss,
  type PageBackground,
} from "@/lib/editor/background";
import {
  THEMES,
  findTemplate,
  type Template,
} from "@/lib/editor/templates";
import type { EditorDocument } from "@/lib/editor/types";
import { formatDate } from "@/lib/format";
import { translate, type TranslationKey } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import {
  PHOTOBOOK_BASE_PRICE_MGA,
  PHOTOBOOK_EXTRA_PAGE_MGA,
  PHOTOBOOK_MIN_PAGES,
  PHOTOBOOK_SLUG,
} from "@/lib/photobook";
import { PAYMENT_ACCOUNTS, PAYMENT_ACCOUNT_NAME } from "@/lib/payment";
import { prisma } from "@/lib/prisma";
import { getProductBySlug } from "@/server/catalog";

/** Modèles mis en avant dans la vitrine d'accueil. */
const SHOWCASE_TEMPLATE_IDS = [
  "pb-fleurs-couronne",
  "pb-luxe-monogramme",
  "pb-dore-cadre",
  "pb-botanique",
  "pb-anniversaire-dore",
  "pb-polaroid",
];

const GALLERY_TEMPLATE_IDS = [
  "pb-fleurs-couronne",
  "pb-luxe-monogramme",
  "pb-dore-cadre",
  "pb-botanique",
  "pb-mosaique",
  "pb-anniversaire-dore",
  "pb-polaroid",
  "pb-editorial-noir",
];

const HERO_SECONDARY_IDS = ["pb-fleurs-couronne", "pb-dore-cadre"];

type ShowcaseItem = {
  key: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  document?: EditorDocument;
};

export default async function HomePage() {
  const locale = await getLocale();
  const t = (key: TranslationKey, replacements?: Record<string, string | number>) =>
    translate(locale, key, replacements);

  const product = await getProductBySlug(PHOTOBOOK_SLUG);
  const [reviewAggregate, latestReviews] = await Promise.all([
    prisma.review.aggregate({
      where: { isPublished: true },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.review.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        customerName: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    }),
  ]);

  const heroCover = findTemplate("pb-luxe-couverture")?.build();
  const heroSecondary = HERO_SECONDARY_IDS.map((id) => findTemplate(id)).filter(
    (template): template is Template => Boolean(template),
  );

  const gallery = GALLERY_TEMPLATE_IDS.map((id) => findTemplate(id))
    .filter((template): template is Template => Boolean(template))
    .map((template) => ({ template, document: template.build() }));

  // Photos de vitrine gérées par l'administrateur, complétées par des modèles
  // tant qu'il n'y a pas assez de photos : la page d'accueil reste habillée.
  const adminPhotos = product
    ? [
        ...(product.imageUrl
          ? [{ url: product.imageUrl, alt: product.nameFr }]
          : []),
        ...product.images.map((image) => ({
          url: image.url,
          alt:
            (locale === "mg" ? image.altMg : image.altFr) ??
            image.altFr ??
            product.nameFr,
        })),
      ].slice(0, 6)
    : [];

  const templateShowcase: ShowcaseItem[] = SHOWCASE_TEMPLATE_IDS.map((id) =>
    findTemplate(id),
  )
    .filter((template): template is Template => Boolean(template))
    .map((template) => ({
      key: template.id,
      title: locale === "mg" ? template.nameMg : template.nameFr,
      subtitle: t("home.showcaseDemoSub"),
      document: template.build(),
    }));

  const showcaseItems: ShowcaseItem[] = [
    ...adminPhotos.map((photo, index) => ({
      key: `photo-${index}`,
      title: photo.alt,
      subtitle: t("home.showcasePhotoSub"),
      imageUrl: photo.url,
    })),
    ...templateShowcase,
  ].slice(0, 6);

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

  const motifs: { key: TranslationKey; background: PageBackground }[] = [
    { key: "editor.pattern.flowers", background: pattern("flowers", "#f2a7bb", "#fff8fa") },
    { key: "editor.pattern.floral", background: pattern("floral", "#e7a86e", "#fff8ef") },
    { key: "editor.pattern.monogram", background: pattern("monogram", "#c9a24a", "#0a2b23") },
    { key: "editor.pattern.gold", background: pattern("gold", "#d4af37", "#121212") },
    { key: "editor.pattern.deco", background: pattern("deco", "#c9a24a", "#111111") },
    { key: "editor.pattern.leaves", background: pattern("leaves", "#9aa887", "#f6f4ec") },
    { key: "editor.pattern.hearts", background: pattern("hearts", "#ef8fa8", "#fff6f8") },
    { key: "editor.pattern.stars", background: pattern("stars", "#e9d7a7", "#101a33") },
    { key: "editor.pattern.waves", background: pattern("waves", "#7fb8c9", "#eef8fb") },
    { key: "editor.pattern.marble", background: pattern("marble", "#cdbba6", "#f7f2e9") },
  ];

  const averageRating = reviewAggregate._avg.rating ?? 0;
  const reviewCount = reviewAggregate._count;

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
              <Camera className="h-3.5 w-3.5" />
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

          {/* Aperçus de livres imprimés */}
          <FadeIn delay={0.12} className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative h-[23rem] sm:h-[28rem]">
              <div className="absolute left-[4%] top-[7%] w-[58%] rotate-[-7deg] rounded-xl shadow-2xl shadow-black/40 transition-transform duration-500 hover:rotate-[-3deg]">
                {heroCover ? <TemplatePreview document={heroCover} width={270} /> : null}
              </div>
              <div className="absolute right-[3%] top-[20%] w-[55%] rotate-[6deg] rounded-xl shadow-2xl shadow-black/50 transition-transform duration-500 hover:rotate-[3deg]">
                {heroSecondary[0] ? (
                  <TemplatePreview document={heroSecondary[0].build()} width={250} />
                ) : null}
              </div>
              <div className="absolute bottom-[1%] left-[20%] w-[52%] rotate-[2deg] rounded-xl shadow-2xl shadow-black/40">
                {heroSecondary[1] ? (
                  <TemplatePreview document={heroSecondary[1].build()} width={240} />
                ) : null}
              </div>

              <div className="absolute -bottom-3 right-0 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-right backdrop-blur-md sm:right-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-200">
                  A4 · A5 · A6 · Carré
                </p>
                <p className="mt-0.5 text-xl font-black text-white">
                  {new Intl.NumberFormat("fr-MG").format(PHOTOBOOK_BASE_PRICE_MGA)} Ar
                </p>
              </div>

              <span className="absolute left-0 top-0 rounded-full bg-brand-500 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">
                Livre photo relié
              </span>
            </div>

            <p className="mt-6 text-center text-[11px] text-slate-400">
              {t("home.heroNote")}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ------------------------------------------------------- Vitrine photos */}
      <section className="border-b border-sand-200 bg-sand-50/70 py-16 sm:py-20 dark:bg-sand-100/40">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Reveal className="max-w-2xl">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
                {t("home.showcaseEyebrow")}
              </span>
              <h2 className="section-title mt-2 text-3xl sm:text-4xl">
                {t("home.showcaseTitle")}
              </h2>
              <p className="muted mt-3 max-w-xl text-base leading-relaxed">
                {t("home.showcaseSubtitle")}
              </p>
            </Reveal>
            <Link
              href="/produits"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline dark:text-brand-300"
            >
              {t("home.showcaseCta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {showcaseItems.map((item, index) => (
              <Reveal key={item.key} delay={index * 0.04}>
                <figure className="group relative overflow-hidden rounded-2xl bg-sand-100 ring-1 ring-sand-200">
                  <div className="h-60 overflow-hidden sm:h-64">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : item.document ? (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sand-100 via-sand-50 to-brand-50/60 p-3 dark:from-sand-200 dark:via-sand-100 dark:to-brand-900/30">
                        <TemplatePreview document={item.document} width={195} />
                      </div>
                    ) : null}
                  </div>
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-4">
                    <p className="text-sm font-bold text-white">{item.title}</p>
                    <p className="mt-0.5 text-[11px] text-white/80">{item.subtitle}</p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
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
              <Reveal key={template.id} delay={index * 0.04}>
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

      {/* ------------------------------------------------------ Motifs & thèmes */}
      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <Reveal>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
              {t("editor.bgPattern")}
            </span>
            <h2 className="section-title mt-2 text-3xl sm:text-4xl">
              {t("home.motifsTitle")}
            </h2>
            <p className="muted mt-3 max-w-xl text-base leading-relaxed">
              {t("home.motifsSubtitle")}
            </p>
            <p className="muted mt-4 text-xs font-semibold">{t("home.motifsHint")}</p>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {motifs.map((motif) => (
                <div key={motif.key} className="card p-2">
                  <div
                    className="h-16 rounded-lg ring-1 ring-sand-300"
                    style={{ background: backgroundToCss(motif.background) }}
                    aria-hidden
                  />
                  <p className="mt-1.5 text-center text-[11px] font-semibold">
                    {t(motif.key)}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <h3 className="text-lg font-bold">{t("home.themesTitle")}</h3>
            <p className="muted mt-1 text-sm">{t("home.themesSubtitle")}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {THEMES.map((theme) => (
                <Link
                  key={theme.id}
                  href="/creer"
                  className="group card flex items-start gap-3 p-4 transition hover:border-brand-300 hover:shadow-md"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-xl dark:bg-brand-900/40">
                    {theme.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold group-hover:text-brand-700 dark:group-hover:text-brand-300">
                      {locale === "mg" ? theme.nameMg : theme.nameFr}
                    </span>
                    <span className="muted mt-0.5 block text-[11px] leading-snug">
                      {locale === "mg" ? theme.descriptionMg : theme.descriptionFr}
                    </span>
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </Link>
              ))}
            </div>

            <Link href="/creer" className="btn-outline mt-4 w-full py-2.5 text-sm">
              <Sparkles className="h-4 w-4" /> {t("home.motifsCta")}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------- Prix */}
      <section id="prix" className="container-page pb-16 sm:pb-20">
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

      {/* -------------------------------------------------------------- Avis */}
      <section id="avis" className="border-y border-sand-200 bg-card py-16 sm:py-20">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Reveal className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
                <Star className="h-3.5 w-3.5" /> {t("review.summary")}
              </span>
              <h2 className="section-title mt-2 text-3xl sm:text-4xl">
                {t("home.reviewsTitle")}
              </h2>
              <p className="muted mt-3 text-base leading-relaxed">
                {t("home.reviewsSubtitle")}
              </p>
            </Reveal>
            <Link
              href="/produits/photobook"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline dark:text-brand-300"
            >
              {t("home.reviewsSee")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {latestReviews.length > 0 ? (
            <div className="mt-8 grid gap-4 lg:grid-cols-[18rem_1fr]">
              <Reveal>
                <div className="card flex h-full flex-col justify-center p-6 text-center">
                  <p className="text-5xl font-black tracking-tight text-ink-900">
                    {averageRating.toFixed(1)}
                  </p>
                  <Stars value={averageRating} size="lg" className="mt-2 justify-center" />
                  <p className="muted mt-2 text-sm">
                    {t("review.average")} · {t("review.count", { count: reviewCount })}
                  </p>
                  <p className="muted mt-4 text-[11px] leading-relaxed">
                    {t("home.reviewsTrust")}
                  </p>
                </div>
              </Reveal>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {latestReviews.map((review, index) => (
                  <Reveal key={review.id} delay={index * 0.05}>
                    <article className="card flex h-full flex-col p-4">
                      <Stars value={review.rating} size="sm" />
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-700">
                        {review.comment ?? t("review.verified")}
                      </p>
                      <div className="mt-3 flex items-center gap-2 border-t border-sand-200 pt-3">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-black text-brand-800 dark:bg-brand-900 dark:text-brand-100">
                          {review.customerName.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold">{review.customerName}</p>
                          <p className="text-[10px] text-ink-500">
                            {t("review.verified")} ·{" "}
                            {formatDate(review.createdAt, locale === "mg" ? "fr-MG" : "fr-FR")}
                          </p>
                        </div>
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          ) : (
            <Reveal className="mt-8">
              <div className="card flex flex-wrap items-center gap-5 p-6">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-950/40">
                  <Star className="h-8 w-8" fill="currentColor" strokeWidth={0} />
                </div>
                <div className="min-w-0 flex-1">
                  <Stars value={0} size="lg" />
                  <p className="muted mt-2 max-w-2xl text-sm leading-relaxed">
                    {t("review.empty")}
                  </p>
                </div>
                <Link href="/produits/photobook" className="btn-outline text-sm">
                  {t("home.reviewsSee")}
                </Link>
              </div>
            </Reveal>
          )}
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

/** Raccourci de lecture pour les vignettes de motifs. */
function pattern(
  id: Extract<PageBackground, { kind: "pattern" }>["pattern"],
  color: string,
  surface: string,
  size = 64,
): PageBackground {
  return { kind: "pattern", pattern: id, color, surface, size };
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EditorShell, type EditorContext } from "@/components/editor/editor-shell";
import { makeInitialDocument } from "@/lib/editor/document";
import { findTemplate, fitDocument } from "@/lib/editor/templates";
import { ensurePageCount } from "@/lib/editor/types";
import type { TranslationKey } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import {
  PHOTOBOOK_MIN_PAGES,
  normalizePageCount,
} from "@/lib/photobook";
import { signInUrl } from "@/lib/return-to";
import { designToDocument, getOwnedDesign } from "@/server/designs";
import { getProductBySlug, productName } from "@/server/catalog";
import { getSessionUser } from "@/server/auth";

export const metadata: Metadata = {
  title: "Atelier de création",
};

type SearchParams = Promise<{
  product?: string;
  variant?: string;
  design?: string;
  template?: string;
  pages?: string;
}>;

export default async function EditorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const {
    product: productSlug,
    variant: variantId,
    design: designId,
    template: templateId,
    pages: pagesParam,
  } = params;
  const locale = await getLocale();

  // L'atelier est réservé aux clients connectés : une création doit pouvoir
  // être retrouvée dans leur espace, et le panier rattaché à un compte.
  const user = await getSessionUser();

  if (!user) {
    const query = new URLSearchParams();
    if (productSlug) query.set("product", productSlug);
    if (variantId) query.set("variant", variantId);
    if (designId) query.set("design", designId);
    if (templateId) query.set("template", templateId);
    if (pagesParam) query.set("pages", pagesParam);

    redirect(signInUrl(query.size > 0 ? `/editeur?${query.toString()}` : "/editeur"));
  }

  const [requestedProduct, design] = await Promise.all([
    productSlug ? getProductBySlug(productSlug) : Promise.resolve(null),
    designId ? getOwnedDesign(designId) : Promise.resolve(null),
  ]);

  // Une création reprise depuis « Mon compte » arrive avec `design` seul : le
  // produit est retrouvé depuis la création pour que l'atelier puisse encore
  // calculer le prix et commander, sans redemander le format au client.
  const product =
    requestedProduct ??
    (design?.product?.slug
      ? await getProductBySlug(design.product.slug)
      : null);

  // Aucun identifiant de format n'est stocké sur la création : la référence du
  // format (papier, orientation, couverture) l'est dans le document, sinon on
  // retombe sur les dimensions cibles, puis sur le format par défaut.
  const storedDocument = design ? designToDocument(design) : null;
  const storedSku = storedDocument?.canvas.variantSku ?? null;

  const designVariant =
    design && product && design.productId === product.id
      ? storedSku
        ? product.variants.find((variant) => variant.sku === storedSku)
        : product.variants.find(
            (variant) =>
              variant.widthMm === design.targetWidthMm &&
              variant.heightMm === design.targetHeightMm,
          )
      : undefined;

  const selectedVariant =
    product?.variants.find((variant) => variant.id === variantId) ??
    designVariant ??
    product?.variants.find((variant) => variant.isDefault) ??
    product?.variants[0] ??
    null;

  const context: EditorContext = {
    productId: product?.id ?? null,
    variantId: selectedVariant?.id ?? null,
    productName: product ? productName(product, locale) : null,
    variantLabel: selectedVariant?.label ?? null,
    variantSku: selectedVariant?.sku ?? null,
    targetWidthMm: selectedVariant?.widthMm ?? null,
    targetHeightMm: selectedVariant?.heightMm ?? null,
  };

  const requestedPages = normalizePageCount(
    Number.parseInt(pagesParam ?? "", 10) || PHOTOBOOK_MIN_PAGES,
  );

  // Trois entrées possibles : rouvrir une création, partir du format commandé,
  // ou ouvrir un livre neuf au nombre de pages choisi dans l'assistant.
  let initialDocument = makeInitialDocument(
    context.targetWidthMm,
    context.targetHeightMm,
    1500,
    requestedPages,
  );

  const template = templateId ? findTemplate(templateId) : undefined;

  // Un photobook neuf porte un nom par défaut : ce nom devient le motif du
  // transfert Mobile Money, le client peut le remplacer à tout moment.
  let initialTitle =
    locale === "mg" ? "Ny photobook-ko" : "Mon photobook";
  let initialNoticeKey: TranslationKey | null = null;

  if (design && storedDocument) {
    const stored = storedDocument;
    const fitted =
      context.targetWidthMm && context.targetHeightMm
        ? fitDocument(stored, initialDocument.canvas.width, initialDocument.canvas.height)
        : stored;

    initialDocument = ensurePageCount(fitted, PHOTOBOOK_MIN_PAGES);
    initialTitle = design.title;
  } else if (template) {
    // Le modèle choisi dans l'assistant s'applique à la couverture ; les pages
    // suivantes restent vierges et se remplissent au fil de la création.
    const built = fitDocument(
      template.build(),
      initialDocument.canvas.width,
      initialDocument.canvas.height,
    );
    const builtPage = built.pages[0];

    if (builtPage) {
      initialDocument = {
        ...initialDocument,
        pages: initialDocument.pages.map((page, index) =>
          index === 0 ? { ...builtPage, id: page.id } : page,
        ),
      };
    }

    initialTitle = locale === "mg" ? template.nameMg : template.nameFr;
    initialNoticeKey = "editor.templateApplied";
  }

  return (
    <EditorShell
      initialDocument={initialDocument}
      initialTitle={initialTitle}
      initialNoticeKey={initialNoticeKey}
      initialDesignId={design?.id ?? null}
      // Le fichier d'impression ne se télécharge que côté équipe : le client
      // commande depuis l'atelier, l'administrateur télécharge et imprime.
      canExport={user.role === "ADMIN"}
      context={context}
      variants={
        product?.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          label: variant.label,
          widthMm: variant.widthMm,
          heightMm: variant.heightMm,
          priceMga: variant.priceMga,
        })) ?? []
      }
    />
  );
}

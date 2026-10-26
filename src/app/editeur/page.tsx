import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EditorShell, type EditorContext } from "@/components/editor/editor-shell";
import { makeInitialDocument } from "@/lib/editor/document";
import { findTemplate, fitDocument } from "@/lib/editor/templates";
import type { TranslationKey } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
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
}>;

export default async function EditorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { product: productSlug, variant: variantId, design: designId, template: templateId } =
    params;
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

    redirect(signInUrl(query.size > 0 ? `/editeur?${query.toString()}` : "/editeur"));
  }

  const [product, design] = await Promise.all([
    productSlug ? getProductBySlug(productSlug) : Promise.resolve(null),
    designId ? getOwnedDesign(designId) : Promise.resolve(null),
  ]);

  const selectedVariant =
    product?.variants.find((variant) => variant.id === variantId) ??
    product?.variants.find((variant) => variant.isDefault) ??
    product?.variants[0] ??
    null;

  const context: EditorContext = {
    productId: product?.id ?? null,
    variantId: selectedVariant?.id ?? null,
    productName: product ? productName(product, locale) : null,
    variantLabel: selectedVariant?.label ?? null,
    targetWidthMm: selectedVariant?.widthMm ?? null,
    targetHeightMm: selectedVariant?.heightMm ?? null,
  };

  // Trois entrées possibles : rouvrir une création, partir du format commandé,
  // ou ouvrir une page blanche.
  let initialDocument = makeInitialDocument(
    context.targetWidthMm,
    context.targetHeightMm,
  );

  const template = templateId ? findTemplate(templateId) : undefined;

  let initialTitle = "";
  let initialNoticeKey: TranslationKey | null = null;

  if (design) {
    const stored = designToDocument(design);
    initialTitle = design.title;
    initialDocument =
      context.targetWidthMm && context.targetHeightMm
        ? fitDocument(stored, initialDocument.canvas.width, initialDocument.canvas.height)
        : stored;
  } else if (template) {
    // Choix fait dans l'assistant `/creer` : le modèle est adapté au format
    // commandé (mise à l'échelle uniforme puis recentrage par `fitDocument`).
    initialDocument = fitDocument(
      template.build(),
      initialDocument.canvas.width,
      initialDocument.canvas.height,
    );
    initialTitle = locale === "mg" ? template.nameMg : template.nameFr;
    initialNoticeKey = "editor.templateApplied";
  }

  return (
    <EditorShell
      initialDocument={initialDocument}
      initialTitle={initialTitle}
      initialNoticeKey={initialNoticeKey}
      initialDesignId={design?.id ?? null}
      context={context}
      variants={
        product?.variants.map((variant) => ({
          id: variant.id,
          label: variant.label,
          widthMm: variant.widthMm,
          heightMm: variant.heightMm,
          priceMga: variant.priceMga,
        })) ?? []
      }
    />
  );
}

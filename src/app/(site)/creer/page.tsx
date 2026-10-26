import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CreateWizard } from "@/components/photobook/create-wizard";
import { PHOTOBOOK_SLUG } from "@/lib/photobook";
import { signInUrl } from "@/lib/return-to";
import { getSessionUser } from "@/server/auth";
import { getProductBySlug } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Créer un photobook",
};

/**
 * Premier écran du parcours de création.
 *
 * Réservé aux clients connectés : la création est conservée dans l'espace du
 * client (`Design.userId`), et l'atelier s'ouvre ensuite avec le format choisi
 * ici. Un visiteur qui arrive directement est renvoyé vers la connexion, puis
 * revient exactement sur cette page.
 */
export default async function CreatePage() {
  const user = await getSessionUser();

  if (!user) redirect(signInUrl("/creer"));

  const product = await getProductBySlug(PHOTOBOOK_SLUG);

  const variants = (product?.variants ?? []).map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    label: variant.label,
    priceMga: variant.priceMga,
    widthMm: variant.widthMm,
    heightMm: variant.heightMm,
  }));

  return <CreateWizard variants={variants} />;
}

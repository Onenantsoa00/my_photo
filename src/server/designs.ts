import { prisma } from "@/lib/prisma";
import { normalizeDocument } from "@/lib/editor/types";
import { ensureCartSessionId, getCartSessionId, getSessionUser } from "@/server/auth";

/**
 * Propriétaire d'une création pour la requête en cours.
 *
 * Un client connecté est identifié par son compte, un visiteur par son cookie
 * de session. `userId` seul ne suffit pas : il vaut `null` pour TOUS les
 * visiteurs, donc `where: { userId: null }` ferait correspondre les créations
 * de visiteurs différents.
 */
export type DesignOwner = {
  userId: string | null;
  guestSessionId: string | null;
  /**
   * L'équipe d'impression travaille sur les créations des clients : un
   * administrateur peut ouvrir n'importe laquelle pour la télécharger et
   * fabriquer le livre.
   */
  admin: boolean;
};

export async function resolveDesignOwner(
  options: { create?: boolean } = {},
): Promise<DesignOwner> {
  const user = await getSessionUser();

  if (user) {
    return { userId: user.id, guestSessionId: null, admin: user.role === "ADMIN" };
  }

  // `create` écrit le cookie de session : réservé aux Server Actions.
  const guestSessionId = options.create
    ? await ensureCartSessionId()
    : await getCartSessionId();

  return { userId: null, guestSessionId, admin: false };
}

/**
 * Clause `where` d'appartenance.
 *
 * Renvoie `null` quand le visiteur n'a pas encore de session : il ne possède
 * alors rien, et l'appelant doit refuser.
 */
export function designOwnerWhere(
  owner: DesignOwner,
): { userId: string } | { userId: null; guestSessionId: string } | null {
  if (owner.userId) return { userId: owner.userId };
  if (!owner.guestSessionId) return null;

  return { userId: null, guestSessionId: owner.guestSessionId };
}

const DESIGN_INCLUDE = {
  product: { select: { id: true, slug: true, nameFr: true, nameMg: true } },
} as const;

/** Charge une création : celle de l'appelant, ou n'importe laquelle pour l'équipe. */
export async function getOwnedDesign(designId: string) {
  const owner = await resolveDesignOwner();
  const where = designOwnerWhere(owner);

  // L'administrateur vient de la fiche commande : il ouvre la création du
  // client pour l'exporter à l'impression. Aucun autre rôle n'a ce passe-droit.
  if (owner.admin) {
    return prisma.design.findFirst({ where: { id: designId }, include: DESIGN_INCLUDE });
  }

  if (!where) return null;

  return prisma.design.findFirst({
    where: { id: designId, ...where },
    include: DESIGN_INCLUDE,
  });
}

/** Vérifie l'appartenance sans charger le document complet. */
export async function assertOwnsDesign(designId: string): Promise<boolean> {
  const owner = await resolveDesignOwner();
  const where = designOwnerWhere(owner);

  if (!where) return false;

  const found = await prisma.design.findFirst({
    where: { id: designId, ...where },
    select: { id: true },
  });

  return Boolean(found);
}

export async function listDesignsForUser(userId: string) {
  return prisma.design.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 60,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      canvasWidth: true,
      canvasHeight: true,
      thumbnailPath: true,
      previewPath: true,
      document: true,
    },
  });
}

/** Document prêt à être réinjecté dans l'atelier. */
export function designToDocument(design: {
  document: unknown;
  canvasWidth: number;
  canvasHeight: number;
}) {
  return normalizeDocument(design.document, design.canvasWidth, design.canvasHeight);
}

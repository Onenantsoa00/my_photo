import { providerAvailability } from "@/server/oauth";
import {
  isDevelopmentCodeShown,
  whatsappConfigured,
  whatsappMissingEnv,
} from "@/server/whatsapp";

/**
 * Ce qui est réellement utilisable sur ce serveur.
 *
 * L'interface s'en sert pour désactiver un moyen de connexion non configuré,
 * plutôt que d'envoyer le client vers une page d'erreur du fournisseur. Le
 * serveur reste seul juge : ces informations ne font qu'éviter un clic inutile.
 */
export type SocialAvailability = {
  google: { available: boolean; missing: string[] };
  facebook: { available: boolean; missing: string[] };
  whatsapp: { available: boolean; devCode: boolean; missing: string[] };
};

export function socialAvailability(): SocialAvailability {
  const providers = providerAvailability();

  return {
    google: {
      available: !providers.google,
      missing: providers.google ? providers.google.split(", ") : [],
    },
    facebook: {
      available: !providers.facebook,
      missing: providers.facebook ? providers.facebook.split(", ") : [],
    },
    whatsapp: {
      // En développement, le code est affiché à l'écran pour permettre de
      // tester le parcours sans compte WhatsApp Business.
      available: whatsappConfigured() || isDevelopmentCodeShown(),
      devCode: isDevelopmentCodeShown(),
      missing: whatsappMissingEnv(),
    },
  };
}

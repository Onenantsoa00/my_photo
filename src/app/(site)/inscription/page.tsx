import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { sanitizeReturnTo } from "@/lib/return-to";
import { getSessionUser } from "@/server/auth";
import { socialAvailability } from "@/server/social-login";

export const metadata: Metadata = {
  title: "Créer un compte",
};

type SearchParams = Promise<{ next?: string }>;

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const user = await getSessionUser();
  const next = sanitizeReturnTo(params.next);

  if (user) redirect(next ?? "/compte");

  const availability = socialAvailability();

  return (
    <div className="container-page flex justify-center py-14">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">{translate(locale, "auth.signUpTitle")}</h1>
        <p className="muted mt-1">
          {locale === "mg"
            ? "Mitahiry ny baikonao sy ny sarinao noforoninao."
            : "Conservez vos commandes et vos créations enregistrées."}
        </p>

        {next ? (
          <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">
            {translate(locale, "auth.signInToContinue")}
          </p>
        ) : null}

        <div className="mt-6">
          <AuthForm mode="signUp" next={next} availability={availability} />
        </div>
      </div>
    </div>
  );
}

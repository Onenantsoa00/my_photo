"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { SocialAuth } from "@/components/social-auth";
import { useT } from "@/components/locale-provider";
import type { TranslationKey } from "@/lib/i18n";
import { signInUrl, signUpUrl } from "@/lib/return-to";
import type { SocialAvailability } from "@/server/social-login";
import {
  signInAction,
  signUpAction,
  type AuthState,
} from "@/server/actions/auth";

const INITIAL: AuthState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <button type="submit" disabled={pending} className="btn-primary w-full py-3 text-base">
      {pending ? t("common.loading") : label}
    </button>
  );
}

export function AuthForm({
  mode,
  next = null,
  availability,
}: {
  mode: "signIn" | "signUp";
  /** Page à rouvrir une fois la session ouverte (création en cours, panier…). */
  next?: string | null;
  availability: SocialAvailability;
}) {
  const t = useT();
  const isSignUp = mode === "signUp";
  const [state, formAction] = useActionState(
    isSignUp ? signUpAction : signInAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {isSignUp ? (
        <div>
          <label className="label" htmlFor="name">
            {t("auth.name")}
          </label>
          <input id="name" name="name" className="input" required autoComplete="name" />
          {state.fieldErrors?.name ? (
            <p className="mt-1 text-xs font-semibold text-accent-600">
              {t("common.invalidValue")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="email">
          {t("auth.email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          required
          autoComplete="email"
        />
      </div>

      {isSignUp ? (
        <div>
          <label className="label" htmlFor="phone">
            {t("auth.phone")}
          </label>
          <input
            id="phone"
            name="phone"
            className="input"
            placeholder="+261 34 12 345 67"
            autoComplete="tel"
          />
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="password">
          {t("auth.password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          required
          minLength={isSignUp ? 8 : undefined}
          autoComplete={isSignUp ? "new-password" : "current-password"}
        />
        {isSignUp ? <p className="muted mt-1 text-xs">{t("auth.passwordHint")}</p> : null}
      </div>

      {state.errorKey ? (
        <p className="rounded-lg bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-700">
          {t(state.errorKey as TranslationKey)}
        </p>
      ) : null}

      <SubmitButton label={isSignUp ? t("auth.submitSignUp") : t("auth.submitSignIn")} />

      <p className="text-center text-sm text-ink-700">
        {isSignUp ? t("auth.hasAccount") : t("auth.noAccount")}{" "}
        <Link
          href={
            isSignUp
              ? next
                ? signInUrl(next)
                : "/connexion"
              : next
                ? signUpUrl(next)
                : "/inscription"
          }
          className="font-semibold text-brand-700 hover:underline"
        >
          {isSignUp ? t("nav.signIn") : t("nav.signUp")}
        </Link>
      </p>

      <SocialAuth mode={mode} next={next} availability={availability} />
    </form>
  );
}

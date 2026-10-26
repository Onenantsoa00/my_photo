"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useT } from "@/components/locale-provider";
import type { TranslationKey } from "@/lib/i18n";
import type { SocialAvailability } from "@/server/social-login";

type Status = { kind: "ok" | "error" | "info"; text: string } | null;

export function SocialAuth({
  mode,
  next,
  availability,
}: {
  mode: "signIn" | "signUp";
  next: string | null;
  availability: SocialAvailability;
}) {
  const t = useT();
  const router = useRouter();

  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);

  const codeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (devCode) codeInputRef.current?.focus();
  }, [devCode]);

  const nextParam = next ? `?next=${encodeURIComponent(next)}` : "";

  const sendCode = async () => {
    setBusy("send");
    setStatus(null);

    try {
      const response = await fetch("/api/auth/whatsapp/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const payload = (await response.json()) as { devCode?: string; errorKey?: TranslationKey };

      if (!response.ok) {
        setStatus({ kind: "error", text: t(payload.errorKey ?? "auth.whatsappCodeInvalid") });
        return;
      }

      setDevCode(payload.devCode ?? null);
      setStatus({ kind: "info", text: t("auth.whatsappCodeSent") });
    } catch {
      setStatus({ kind: "error", text: t("auth.oauthFailed") });
    } finally {
      setBusy(null);
    }
  };

  const verifyCode = async () => {
    setBusy("verify");
    setStatus(null);

    try {
      const response = await fetch("/api/auth/whatsapp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code, name, next }),
      });
      const payload = (await response.json()) as { redirect?: string; errorKey?: TranslationKey };

      if (!response.ok || !payload.redirect) {
        setStatus({ kind: "error", text: t(payload.errorKey ?? "auth.whatsappCodeInvalid") });
        return;
      }

      router.push(payload.redirect);
      router.refresh();
    } catch {
      setStatus({ kind: "error", text: t("auth.oauthFailed") });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-sand-200" />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {t("auth.or")}
        </span>
        <span className="h-px flex-1 bg-sand-200" />
      </div>

      <p className="muted mt-3 text-center text-xs">{t("auth.socialHint")}</p>

      <div className="mt-3 space-y-2">
        <ProviderButton
          label={t("auth.google")}
          icon="G"
          href={`/api/auth/google/start${nextParam}`}
          available={availability.google.available}
          missing={availability.google.missing}
        />
        <ProviderButton
          label={t("auth.facebook")}
          icon="f"
          href={`/api/auth/facebook/start${nextParam}`}
          available={availability.facebook.available}
          missing={availability.facebook.missing}
        />
        <button
          type="button"
          onClick={() => setWhatsappOpen((value) => !value)}
          aria-expanded={whatsappOpen}
          disabled={!availability.whatsapp.available}
          title={
            availability.whatsapp.available
              ? undefined
              : `${t("auth.providerUnconfigured")} — ${availability.whatsapp.missing.join(", ")}`
          }
          className="btn-outline w-full justify-center gap-2 py-2.5 text-sm disabled:opacity-60"
        >
          <span aria-hidden className="text-base">
            🟢
          </span>
          {t("auth.whatsapp")}
        </button>
      </div>

      {whatsappOpen ? (
        <div className="mt-4 rounded-xl border border-sand-200 bg-sand-50 p-4">
          <h2 className="text-sm font-bold">{t("auth.whatsappTitle")}</h2>
          <p className="muted mt-1 text-xs leading-relaxed">{t("auth.whatsappHint")}</p>

          {availability.whatsapp.devCode ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t("auth.whatsappDevHint")}
            </p>
          ) : null}

          <div className="mt-3 space-y-3">
            <div>
              <label className="label" htmlFor="whatsapp-phone">
                {t("auth.whatsappPhone")}
              </label>
              <input
                id="whatsapp-phone"
                className="input"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+261 34 12 345 67"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            {mode === "signUp" ? (
              <div>
                <label className="label" htmlFor="whatsapp-name">
                  {t("auth.whatsappName")}
                </label>
                <input
                  id="whatsapp-name"
                  className="input"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            ) : null}

            <button
              type="button"
              className="btn-outline w-full justify-center py-2.5 text-sm"
              onClick={sendCode}
              disabled={busy !== null || phone.trim().length < 7}
            >
              {busy === "send" ? t("common.loading") : t("auth.whatsappSend")}
            </button>

            {status?.kind === "info" || devCode ? (
              <div>
                <label className="label" htmlFor="whatsapp-code">
                  {t("auth.whatsappCode")}
                </label>
                <input
                  id="whatsapp-code"
                  ref={codeInputRef}
                  className="input font-mono tracking-[0.3em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                />

                {devCode ? (
                  <p className="mt-2 text-xs font-semibold text-amber-800">
                    {t("auth.whatsappDevHint")} <span className="font-mono">{devCode}</span>
                  </p>
                ) : null}

                <button
                  type="button"
                  className="btn-primary mt-3 w-full justify-center py-2.5 text-sm"
                  onClick={verifyCode}
                  disabled={busy !== null || code.length !== 6}
                >
                  {busy === "verify" ? t("common.loading") : t("auth.whatsappVerify")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {status ? (
        <p
          role="status"
          className={
            status.kind === "error"
              ? "mt-3 rounded-lg bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-700"
              : "mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800"
          }
        >
          {status.text}
        </p>
      ) : null}
    </div>
  );
}

function ProviderButton({
  label,
  icon,
  href,
  available,
  missing,
}: {
  label: string;
  icon: string;
  href: string;
  available: boolean;
  missing: string[];
}) {
  const t = useT();

  if (!available) {
    return (
      <button
        type="button"
        disabled
        title={`${t("auth.providerUnconfigured")} — ${missing.join(", ")}`}
        className="btn-outline w-full justify-center gap-2 py-2.5 text-sm opacity-60"
      >
        <span aria-hidden className="text-base">
          {icon}
        </span>
        {label}
      </button>
    );
  }

  return (
    <a href={href} className="btn-outline w-full justify-center gap-2 py-2.5 text-sm">
      <span aria-hidden className="text-base">
        {icon}
      </span>
      {label}
    </a>
  );
}

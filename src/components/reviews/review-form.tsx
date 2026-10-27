"use client";

import { Check, Star } from "lucide-react";
import { useActionState, useState } from "react";

import { useT } from "@/components/locale-provider";
import { createReviewAction, type ReviewState } from "@/server/actions/reviews";

/**
 * Note étoilée proposée après réception de la commande.
 * Facultative : le client peut simplement fermer la page.
 */
export function ReviewForm({ orderId }: { orderId: string }) {
  const t = useT();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [state, action, pending] = useActionState<ReviewState, FormData>(
    createReviewAction,
    {},
  );

  if (state.ok) {
    return (
      <div className="rounded-xl bg-brand-50 p-4 ring-1 ring-brand-200 dark:bg-brand-900/30 dark:ring-brand-800">
        <p className="flex items-center gap-2 text-sm font-bold text-brand-800 dark:text-brand-100">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-white">
            <Check className="h-3.5 w-3.5" />
          </span>
          {t("review.thanks")}
        </p>
        <p className="mt-1 text-xs text-brand-700 dark:text-brand-200">
          {t("review.published")}
        </p>
      </div>
    );
  }

  const shown = hover || rating;

  return (
    <form action={action} className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="rating" value={rating} />

      <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
        {t("review.title")}
      </p>
      <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
        {t("review.ratePrompt")}
      </p>

      <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} / 5`}
            aria-pressed={rating === star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            className="rounded-md p-0.5 text-amber-500 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            <Star
              className="h-7 w-7"
              fill={star <= shown ? "currentColor" : "none"}
              strokeWidth={star <= shown ? 0 : 1.8}
            />
          </button>
        ))}
        {rating > 0 ? (
          <span className="ml-2 text-sm font-bold text-amber-900 dark:text-amber-100">
            {rating} / 5
          </span>
        ) : null}
      </div>

      <label className="mt-3 block text-[11px] font-semibold text-amber-900 dark:text-amber-100" htmlFor="review-comment">
        {t("review.commentLabel")}
      </label>
      <textarea
        id="review-comment"
        name="comment"
        maxLength={600}
        rows={3}
        placeholder={t("review.commentHint")}
        className="input mt-1 w-full bg-card px-2 py-1.5 text-sm"
      />

      {state.errorKey ? (
        <p className="mt-2 text-xs font-semibold text-accent-600">{t(state.errorKey)}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={rating === 0 || pending}
          className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? t("common.loading") : t("review.submit")}
        </button>
        <span className="text-[11px] text-amber-800 dark:text-amber-200">
          {t("review.optional")}
        </span>
      </div>
    </form>
  );
}

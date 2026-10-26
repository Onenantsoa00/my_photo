"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <div className="max-w-md">
        <p className="text-5xl">⚠️</p>
        <h1 className="mt-4 text-2xl font-black">Une erreur est survenue</h1>
        <p className="muted mt-2">
          Nisy olana kely. Andramo indray azafady. / Réessayez dans un instant.
        </p>
        {error.digest ? (
          <p className="muted mt-2 font-mono text-xs">Réf. {error.digest}</p>
        ) : null}
        <button type="button" onClick={reset} className="btn-primary mt-6">
          Réessayer
        </button>
      </div>
    </div>
  );
}

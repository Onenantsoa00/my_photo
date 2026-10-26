"use client";

/**
 * Bouton de soumission qui demande confirmation avant d'envoyer le formulaire.
 * Sert aux suppressions du back-office : pas de suppression au premier clic.
 */
export function ConfirmSubmit({
  message,
  children,
  className,
  name,
  value,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
  name?: string;
  value?: string;
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

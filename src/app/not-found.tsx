import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <p className="text-5xl">📷</p>
        <h1 className="mt-4 text-3xl font-black">Page introuvable</h1>
        <p className="muted mt-2">
          Tsy hita ity pejy ity. / Cette page n&apos;existe pas.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">
            Accueil / Fandraisana
          </Link>
          <Link href="/produits" className="btn-outline">
            Produits / Vokatra
          </Link>
        </div>
      </div>
    </div>
  );
}

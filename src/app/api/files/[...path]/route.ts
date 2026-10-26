import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { resolveStoragePath } from "@/lib/storage";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/**
 * Sert les fichiers téléversés. On ne s'appuie pas sur /public : les contenus
 * utilisateurs restent hors du dossier servi statiquement et sont donc soumis à
 * cette validation de chemin.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relativePath = segments.join("/");

  let absolute: string;
  try {
    absolute = resolveStoragePath(relativePath);
  } catch {
    return NextResponse.json({ error: "INVALID_PATH" }, { status: 400 });
  }

  const extension = path.extname(absolute).toLowerCase();
  const contentType = CONTENT_TYPES[extension];

  if (!contentType) {
    return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 415 });
  }

  try {
    const info = await stat(absolute);
    if (!info.isFile()) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream;

    return new NextResponse(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        // Contenu immuable : le nom de fichier contient l'empreinte du contenu.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
}

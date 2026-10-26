import { NextResponse } from "next/server";
import sharp from "sharp";

import {
  ALLOWED_MIME_TYPES,
  buildRelativePath,
  shortHash,
  writeStorageFile,
} from "@/lib/storage";
import { storageUrl } from "@/lib/storage-url";

export const runtime = "nodejs";

/** 25 Mo : une photo de reflex reste sous cette limite. */
const MAX_BYTES = 25 * 1024 * 1024;
/** Au-delà, on redimensionne : inutile pour un tirage A0 en 300 dpi à 4000 px. */
const MAX_SIDE = 4000;
const THUMB_SIDE = 480;

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "MULTIPART_REQUIRED" }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "UNSUPPORTED_TYPE", allowed: ALLOWED_MIME_TYPES },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
  }

  const input = Buffer.from(await file.arrayBuffer());

  try {
    const pipeline = sharp(input, { failOn: "none" })
      // Respecte l'orientation EXIF : sans ça les photos de téléphone sortent
      // couchées à l'impression.
      .rotate()
      .resize({
        width: MAX_SIDE,
        height: MAX_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      });

    const normalized = await pipeline.webp({ quality: 90 }).toBuffer({
      resolveWithObject: true,
    });

    const signature = shortHash(normalized.data);
    const relativePath = buildRelativePath("webp", `${signature}-`);
    await writeStorageFile(relativePath, normalized.data);

    const thumbnailBuffer = await sharp(normalized.data)
      .resize({ width: THUMB_SIDE, height: THUMB_SIDE, fit: "inside" })
      .webp({ quality: 80 })
      .toBuffer();

    const thumbnailPath = buildRelativePath("webp", `${signature}-thumb-`);
    await writeStorageFile(thumbnailPath, thumbnailBuffer);

    return NextResponse.json({
      path: relativePath,
      url: storageUrl(relativePath),
      thumbnailUrl: storageUrl(thumbnailPath),
      width: normalized.info.width,
      height: normalized.info.height,
    });
  } catch {
    return NextResponse.json({ error: "PROCESSING_FAILED" }, { status: 422 });
  }
}

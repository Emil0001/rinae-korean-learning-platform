import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getBlobReadWriteToken } from "@/lib/vercel-blob";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return NextResponse.json(
      { error: "Blob storage is not configured for this project." },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const jsonResponse = await handleUpload({
      token,
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("course-images/")) {
          throw new Error("Invalid course image upload path.");
        }

        return {
          allowedContentTypes: ALLOWED_IMAGE_CONTENT_TYPES,
          maximumSizeInBytes: MAX_IMAGE_SIZE_BYTES,
          addRandomSuffix: false,
        };
      },
      onUploadCompleted: async () => undefined,
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to prepare course image upload.",
      },
      { status: 400 },
    );
  }
}

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getBlobReadWriteToken } from "@/lib/vercel-blob";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ testId: string }> | { testId: string };
};

const ALLOWED_AUDIO_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/x-m4a",
  "audio/mp4",
  "audio/webm",
  "application/octet-stream",
];

export async function POST(request: NextRequest, context: RouteContext) {
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

  const { testId } = await context.params;
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      token,
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(`topik-listening/${testId}-`)) {
          throw new Error("Invalid audio upload path.");
        }

        return {
          allowedContentTypes: ALLOWED_AUDIO_CONTENT_TYPES,
          addRandomSuffix: false,
        };
      },
      onUploadCompleted: async () => undefined,
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to prepare audio upload.",
      },
      { status: 400 },
    );
  }
}

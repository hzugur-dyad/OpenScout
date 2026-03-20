import { NextRequest, NextResponse } from "next/server";
import type { ZodError, ZodType } from "zod";

export function validationErrorResponse(error: ZodError) {
  return NextResponse.json(
    {
      error: "Validation failed",
      message: error.message,
      issues: error.issues,
    },
    { status: 400 }
  );
}

export async function parseJsonBody<T>(
  request: NextRequest,
  schema: ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Invalid JSON body",
          message: "Request body must be valid JSON",
          issues: [] as const,
        },
        { status: 400 }
      ),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, response: validationErrorResponse(result.error) };
  }
  return { ok: true, data: result.data };
}

export function parseWithSchema<T>(
  schema: ZodType<T>,
  value: unknown
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(value);
  if (!result.success) {
    return { ok: false, response: validationErrorResponse(result.error) };
  }
  return { ok: true, data: result.data };
}

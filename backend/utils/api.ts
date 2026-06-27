import type { Response } from "express";

export function notFound(res: Response, message = "Resource not found") {
  return res.status(404).json({ success: false, error: message });
}

export function serverError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return res.status(500).json({ success: false, error: message });
}

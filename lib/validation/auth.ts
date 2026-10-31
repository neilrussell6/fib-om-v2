import { z } from "zod";

/** Emails are compared and stored trimmed and lowercased. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/** Spec 01: at least 12 characters, no other rules. Shared with the Users screen (spec 02). */
export const PASSWORD_MIN_LENGTH = 12;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);

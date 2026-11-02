/** A numeric record id as the app accepts it from URLs and Server Action calls: 1–18 digits (spec 06/07). */
export const isId = (v: unknown): v is string | number => /^\d{1,18}$/.test(String(v));

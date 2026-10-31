/** Spec 01: JWT cookie sessions with an 8-hour rolling lifetime, refreshed every 15 minutes of activity. */
export const sessionConfig = {
  strategy: "jwt" as const,
  maxAge: 8 * 60 * 60,
  updateAge: 15 * 60,
};

-- Review 02: sign-out must stick. JWT sessions carry the user's session_version;
-- every auth check compares it with this column, and sign-out increments it, so
-- any session cookie issued before sign-out (even one re-set by a late prefetch) is rejected.
ALTER TABLE users ADD COLUMN session_version integer NOT NULL DEFAULT 0;

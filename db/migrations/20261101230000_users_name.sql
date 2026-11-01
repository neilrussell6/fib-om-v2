-- Spec 06: an optional display name, shown in the sidebar (falls back to the email).
ALTER TABLE users ADD COLUMN name text;

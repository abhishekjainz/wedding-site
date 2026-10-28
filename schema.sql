-- Dreamy & Abhishek wedding site — Cloudflare D1 (SQLite) schema
CREATE TABLE IF NOT EXISTS invitation_groups (
  id INTEGER PRIMARY KEY,           -- 1 Friends, 2 Close Family, 3 Family & Guests, 4 Other Guests
  label TEXT NOT NULL               -- access codes live in Worker secrets, never in the DB
);
INSERT OR IGNORE INTO invitation_groups (id, label) VALUES (1, 'Friends'), (2, 'Close Family'), (3, 'Family & Guests'), (4, 'Other Guests');

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  sort INTEGER NOT NULL,
  data TEXT NOT NULL                -- JSON: date, start, end, groups, title/desc/dress/location (en, hi), mapsUrl
);

CREATE TABLE IF NOT EXISTS website_content (
  key TEXT PRIMARY KEY,             -- 'content' | 'settings'
  value TEXT NOT NULL,              -- JSON incl. English/Hindi translations
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rsvp_submissions (
  id TEXT PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES invitation_groups(id),
  status TEXT NOT NULL CHECK (status IN ('accept', 'decline')),
  primary_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  arrival_date TEXT, arrival_window TEXT,
  departure_date TEXT, departure_window TEXT,
  song_name TEXT, song_artist TEXT, song_url TEXT,
  questions TEXT, note TEXT,
  extras TEXT,                      -- JSON: optional extra answers (drink, drinkName, advice)
  source TEXT NOT NULL DEFAULT 'web',
  admin_notes TEXT,
  edit_token_hash TEXT NOT NULL UNIQUE,  -- SHA-256 only; raw token is shown to the guest once
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sub_phone ON rsvp_submissions(phone);

CREATE TABLE IF NOT EXISTS rsvp_guests (
  submission_id TEXT NOT NULL REFERENCES rsvp_submissions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  PRIMARY KEY (submission_id, position)
);

CREATE TABLE IF NOT EXISTS rsvp_event_selections (
  submission_id TEXT NOT NULL REFERENCES rsvp_submissions(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,           -- event id, or 'event@YYYY-MM-DD' for one day of a multi-day event
  PRIMARY KEY (submission_id, event_id)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL
);

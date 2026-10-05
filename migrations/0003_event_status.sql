ALTER TABLE events ADD COLUMN status TEXT NOT NULL DEFAULT 'accepting_participants';
ALTER TABLE events ADD COLUMN started_at DATETIME;

CREATE TABLE event_participants_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id)
);

INSERT INTO event_participants_new SELECT * FROM event_participants;

DROP TABLE event_participants;

ALTER TABLE event_participants_new RENAME TO event_participants;

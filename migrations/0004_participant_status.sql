ALTER TABLE event_participants ADD COLUMN status TEXT NOT NULL DEFAULT 'joined';

UPDATE event_participants SET status = 'assigned_team' WHERE team_id IS NOT NULL;

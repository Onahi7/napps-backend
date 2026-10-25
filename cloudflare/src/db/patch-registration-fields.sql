-- Apply once to existing D1 databases. No records are deleted or merged.
ALTER TABLE proprietors ADD COLUMN dues_declarations TEXT NOT NULL DEFAULT '[]';
ALTER TABLE schools ADD COLUMN total_enrollment INTEGER;

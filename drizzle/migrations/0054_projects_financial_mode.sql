ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS financialMode ENUM('commercial', 'internal') NOT NULL DEFAULT 'commercial';

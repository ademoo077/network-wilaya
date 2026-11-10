ALTER TABLE agents ADD COLUMN grade TEXT CHECK(grade IS NULL OR length(grade) <= 200);
ALTER TABLE agents ADD COLUMN email TEXT CHECK(email IS NULL OR length(email) <= 254);
CREATE INDEX idx_agents_email ON agents(email COLLATE NOCASE) WHERE email IS NOT NULL;

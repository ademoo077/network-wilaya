ALTER TABLE epics ADD COLUMN workflow_json TEXT
  CHECK(workflow_json IS NULL OR (length(workflow_json) <= 100000 AND json_valid(workflow_json)));

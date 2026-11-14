CREATE TABLE polls (
 id TEXT PRIMARY KEY CHECK(id IN ('search','object')),
 question TEXT NOT NULL,
 options_json TEXT NOT NULL,
 opened INTEGER NOT NULL DEFAULT 0 CHECK(opened IN (0,1)),
 revealed INTEGER NOT NULL DEFAULT 0 CHECK(revealed IN (0,1))
);
CREATE TABLE votes (
 event_id TEXT NOT NULL,
 poll_id TEXT NOT NULL REFERENCES polls(id),
 voter_hash TEXT NOT NULL,
 choice INTEGER NOT NULL CHECK(choice >= 0 AND choice < 6),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(event_id,poll_id,voter_hash)
);

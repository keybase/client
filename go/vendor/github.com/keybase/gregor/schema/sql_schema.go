package schema

import (
	"database/sql"
)

var schema = []string{

	`DROP TABLE IF EXISTS dismissals_by_time`,
	`DROP TABLE IF EXISTS dismissals_by_id`,
	`DROP TABLE IF EXISTS reminders`,
	`DROP TABLE IF EXISTS items`,
	`DROP TABLE IF EXISTS messages`,

	`CREATE TABLE messages (
		uid   CHAR(32) NOT NULL,
		msgid CHAR(32) NOT NULL,
		ctime DATETIME(6) NOT NULL,
		devid CHAR(32),
		mtype INTEGER UNSIGNED NOT NULL, -- "specify for 'Update' or 'Sync' types",
		PRIMARY KEY(uid, msgid)
	)`,

	`CREATE TABLE items (
		uid   CHAR(32) NOT NULL,
		msgid CHAR(32) NOT NULL,
		category VARCHAR(128) NOT NULL,
		dtime DATETIME(6),
		body BLOB,
		FOREIGN KEY(uid, msgid) REFERENCES messages (uid, msgid) ON DELETE CASCADE,
		PRIMARY KEY(uid, msgid)
	)`,

	`CREATE INDEX user_order ON items (uid, category)`,

	`CREATE INDEX cleanup_order ON items (uid, dtime)`,

	`CREATE TABLE reminders (
		uid   CHAR(32) NOT NULL,
		msgid CHAR(32) NOT NULL,
		rtime DATETIME(6) NOT NULL,
		FOREIGN KEY(uid, msgid) REFERENCES messages (uid, msgid) ON DELETE CASCADE,
		PRIMARY KEY(uid, msgid, rtime)
	)`,

	`CREATE TABLE dismissals_by_id (
		uid   CHAR(32) NOT NULL,
		msgid CHAR(32) NOT NULL,
		dmsgid CHAR(32) NOT NULL, -- "the message IDs to dismiss",
		FOREIGN KEY(uid, msgid) REFERENCES messages (uid, msgid) ON DELETE CASCADE,
		FOREIGN KEY(uid, dmsgid) REFERENCES messages (uid, msgid) ON DELETE CASCADE,
		PRIMARY KEY(uid, msgid, dmsgid)
	)`,

	`CREATE TABLE dismissals_by_time (
		uid   CHAR(32) NOT NULL,
		msgid CHAR(32) NOT NULL,
		category VARCHAR(128) NOT NULL,
		dtime DATETIME(6) NOT NULL, -- "throw out matching events before dtime",
		FOREIGN KEY(uid, msgid) REFERENCES messages (uid, msgid) ON DELETE CASCADE,
		PRIMARY KEY(uid, msgid, category, dtime)
	)`,
}

func Schema(engine string) []string {
	return schema
}

// CreateDB connects to a DB and initializes it with Gregor Schema.
func CreateDB(engine string, name string) (*sql.DB, error) {
	db, err := sql.Open(engine, name)
	if err != nil {
		return nil, err
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}

	for _, stmt := range Schema(engine) {
		if _, err := tx.Exec(stmt); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return db, nil
}

package storage

import (
	"database/sql"
	"log"
	"net/url"
	"os"
	"sync"
	"testing"

	_ "github.com/go-sql-driver/mysql"
)

var (
	db     *sql.DB
	dbLock sync.Mutex
)

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

// AcquireTestDB returns a MySQL DB and acquires a lock be released with ReleaseTestDB.
func AcquireTestDB(t *testing.T) *sql.DB {
	s := os.Getenv("MYSQL_DSN")
	dsn := ""
	if s != "" {
		udsn, err := url.Parse(s)
		if err != nil {
			t.Skip("Error parsing MYSQL_DSN")
		}
		query := udsn.Query()
		query.Set("parseTime", "true")
		udsn.RawQuery = query.Encode()

		dsn = udsn.String()
	}

	if dsn == "" {
		t.Skip("Error parsing MYSQL_DSN")
	}

	dbLock.Lock()
	log.Println("Acquiring Test DB")
	if db == nil {
		log.Println("Connecting to Test DB")
		var err error
		db, err = sql.Open("mysql", dsn)
		if err != nil {
			dbLock.Unlock()
			t.Fatal(err)
		}
	} else {
		log.Println("Reusing connection to Test DB")
	}
	return db
}

// ReleaseTestDB releases a lock acquired by AcquireTestDB.
func ReleaseTestDB() {
	log.Println("Releasing Test DB")
	dbLock.Unlock()
}

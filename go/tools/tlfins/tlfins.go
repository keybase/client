package main

import (
	"database/sql"
	"encoding/json"
	"flag"
	"log"
	"os/exec"

	_ "github.com/go-sql-driver/mysql"
)

var home = flag.String("home", "/Users/patrick/kbtest", "home directory")
var bin = flag.String("bin", "/Users/patrick/bin/keybase", "keybase binary")
var dsn = flag.String("dsn", "root:@/keybase", "db dsn")

func trap(name string, arg ...string) ([]byte, error) {
	cmd := exec.Command(name, arg...)
	b, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return b, nil
}

type status struct {
	Username string
	UserID   string
	Device   struct {
		DeviceID string
	}
}

func main() {
	log.Printf("tlfins")
	flag.Parse()
	tlfid := flag.Arg(0)
	if len(tlfid) == 0 {
		log.Fatal("tlfid required: tlfins <tlfid>")
	}
	log.Printf("home: %s", *home)
	log.Printf("bin: %s", *bin)
	out, err := trap(*bin, "-H", *home, "-s", "http://localhost:3000", "status", "-json")
	if err != nil {
		log.Fatal(err)
	}
	var s status
	if err := json.Unmarshal(out, &s); err != nil {
		log.Fatal(err)
	}
	log.Printf("status: %+v", s)

	db, err := sql.Open("mysql", *dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	_, err = db.Exec("INSERT INTO kbfs_tlfs SET tlf_id = UNHEX(?), last_modifying_writer=0, last_modifying_writer_device=0, last_modifying_user=0, last_modifying_user_device=0, first_writer=0, is_private=0, revision=1, usage_bytes=337, rekey_needed=0, is_copy=0, key_gen=0, ctime=NOW(), mtime=NOW()", tlfid)
	if err != nil {
		log.Fatal(err)
	}
	_, err = db.Exec("INSERT INTO kbfs_tlf_members SET tlf_id=UNHEX(?), uid=UNHEX(?), read_only=false, ctime=NOW()", tlfid, s.UserID)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("done")
}

package storage

import (
	"encoding/hex"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
)

type localStorageRecord struct {
	Dismissals [][]byte `json:"d"`
	Outbox     [][]byte `json:"o"`
}

type LocalDb struct {
	libkb.Contextified
}

func NewLocalDB(g *libkb.GlobalContext) *LocalDb {
	return &LocalDb{
		Contextified: libkb.NewContextified(g),
	}
}

func dbKey(u gregor.UID) libkb.DbKey {
	return libkb.DbKey{Typ: libkb.DBGregor, Key: hex.EncodeToString(u.Bytes())}
}

func dbKeyLocal(u gregor.UID) libkb.DbKey {
	return libkb.DbKey{Typ: libkb.DBGregor, Key: "_ld" + hex.EncodeToString(u.Bytes())}
}

func (db *LocalDb) Store(u gregor.UID, state []byte, outbox [][]byte, localDismissals [][]byte) error {
	if err := db.G().LocalDb.PutRaw(dbKey(u), state); err != nil {
		return err
	}
	ldr := localStorageRecord{
		Dismissals: localDismissals,
		Outbox:     outbox,
	}
	return db.G().LocalDb.PutObj(dbKeyLocal(u), nil, ldr)
}

func (db *LocalDb) Load(u gregor.UID) (state []byte, outbox [][]byte, localDismissals [][]byte, err error) {
	if state, _, err = db.G().LocalDb.GetRaw(dbKey(u)); err != nil {
		return state, outbox, localDismissals, err
	}
	var ldr localStorageRecord
	if _, err = db.G().LocalDb.GetInto(&ldr, dbKeyLocal(u)); err != nil {
		return state, outbox, localDismissals, err
	}
	return state, ldr.Outbox, ldr.Dismissals, nil
}

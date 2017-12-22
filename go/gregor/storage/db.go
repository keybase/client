package storage

import (
	"encoding/hex"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
)

type localDismissalsRecord struct {
	Dismissals [][]byte `json:"d"`
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

func dbKeyLocalDismiss(u gregor.UID) libkb.DbKey {
	return libkb.DbKey{Typ: libkb.DBGregor, Key: "_ld" + hex.EncodeToString(u.Bytes())}
}

func (db *LocalDb) Store(u gregor.UID, state []byte, localDismissals [][]byte) error {
	if err := db.G().LocalDb.PutRaw(dbKey(u), state); err != nil {
		return err
	}
	ldr := localDismissalsRecord{
		Dismissals: localDismissals,
	}
	return db.G().LocalDb.PutObj(dbKeyLocalDismiss(u), nil, ldr)
}

func (db *LocalDb) Load(u gregor.UID) (state []byte, localDismissals [][]byte, err error) {
	if state, _, err = db.G().LocalDb.GetRaw(dbKey(u)); err != nil {
		return state, localDismissals, err
	}
	var ldr localDismissalsRecord
	if _, err = db.G().LocalDb.GetInto(&ldr, dbKeyLocalDismiss(u)); err != nil {
		return state, localDismissals, err
	}
	return state, ldr.Dismissals, nil
}

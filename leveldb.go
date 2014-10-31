package libkb

import (
	"fmt"
	"github.com/syndtr/goleveldb/leveldb"
	"os"
)

type LevelDb struct {
	db       *leveldb.DB
	filename string
}

func NewLevelDb() *LevelDb {
	return &LevelDb{nil, ""}
}

// Explicit open does nothing we'll wait for a lazy open
func (l *LevelDb) Open() error { return nil }

func (l *LevelDb) open() error {
	var err error
	if l.db == nil {
		fn := l.GetFilename()
		G.Log.Debug("Opening LevelDB for local cache: %s", fn)
		l.db, err = leveldb.OpenFile(fn, nil)
	}
	return err
}

func (l *LevelDb) GetFilename() string {
	if len(l.filename) == 0 {
		l.filename = G.Env.GetDbFilename()
	}
	return l.filename
}

func (l *LevelDb) Close() error {
	var err error
	if l.db != nil {
		G.Log.Debug("Closing LevelDB local cache: %s", l.GetFilename())
		err = l.db.Close()
		l.db = nil
	}
	return err
}

func (l *LevelDb) Nuke() error {
	err := l.Close()
	if err == nil {
		fn := l.GetFilename()
		G.Log.Warning("Nuking database %s", fn)
		err = os.RemoveAll(fn)
	}
	return err
}

func (l *LevelDb) Put(id DbKey, aliases []DbKey, value []byte) error {

	// Lazy Open
	if err := l.open(); err != nil {
		return err
	}

	batch := new(leveldb.Batch)
	idb := id.ToBytes("kv")
	batch.Put(idb, value)
	for _, alias := range aliases {
		batch.Put(alias.ToBytes("lo"), idb)
	}

	err := l.db.Write(batch, nil)

	return err
}

func (l *LevelDb) get(id DbKey, which string) ([]byte, bool, error) {
	val, err := l.db.Get(id.ToBytes(which), nil)
	found := false
	if err == nil {
		found = true
	} else if err == leveldb.ErrNotFound {
		err = nil
	}
	return val, found, err
}

func (l *LevelDb) Get(id DbKey) ([]byte, bool, error) {
	// Lazy Open
	if err := l.open(); err != nil {
		return nil, false, err
	}

	return l.get(id, "kv")
}

func (l *LevelDb) Lookup(id DbKey) ([]byte, bool, error) {
	// Lazy Open
	if err := l.open(); err != nil {
		return nil, false, err
	}

	val, found, err := l.get(id, "lo")
	if found {
		if tab, id2, err2 := DbKeyParse(string(val)); err2 != nil {
			err = err2
		} else if tab != "kv" {
			err = fmt.Errorf("bad alias; expected 'kv' but got '%s'", tab)
		} else {
			val, found, err = l.Get(*id2)
		}
	}
	return val, found, err
}

func (l *LevelDb) Delete(id DbKey) error {
	// Lazy Open
	if err := l.open(); err != nil {
		return err
	}

	err := l.db.Delete(id.ToBytes("kv"), nil)
	return err
}

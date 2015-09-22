package libkb

import (
	"fmt"
	"os"
	"sync"

	"github.com/syndtr/goleveldb/leveldb"
)

type LevelDb struct {
	db       *leveldb.DB
	filename string
	sync.Mutex
}

func NewLevelDb() *LevelDb {
	return &LevelDb{}
}

// Explicit open does nothing we'll wait for a lazy open
func (l *LevelDb) Open() error { return nil }

func (l *LevelDb) open() error {
	l.Lock()
	defer l.Unlock()

	var err error
	if l.db == nil {
		fn := l.GetFilename()
		G.Log.Debug("Opening LevelDB for local cache: %s", fn)
		l.db, err = leveldb.OpenFile(fn, nil)
	}
	return err
}

// ForceOpen opens the leveldb file.  This is used in situations
// where we want to get around the lazy open and make sure we can
// use it later.
func (l *LevelDb) ForceOpen() error {
	return l.open()
}

func (l *LevelDb) GetFilename() string {
	if len(l.filename) == 0 {
		l.filename = G.Env.GetDbFilename()
	}
	return l.filename
}

func (l *LevelDb) Close() error {
	return l.close(true)
}

func (l *LevelDb) close(doLock bool) error {
	if doLock {
		l.Lock()
		defer l.Unlock()
	}

	var err error
	if l.db != nil {
		G.Log.Debug("Closing LevelDB local cache: %s", l.GetFilename())
		err = l.db.Close()
		l.db = nil
	}
	return err
}

func (l *LevelDb) Nuke() (string, error) {
	l.Lock()
	defer l.Unlock()

	err := l.close(false)
	if err == nil {
		fn := l.GetFilename()
		err = os.RemoveAll(fn)
		return fn, err
	}
	return "", err
}

func (l *LevelDb) Put(id DbKey, aliases []DbKey, value []byte) error {

	// Lazy Open
	if err := l.open(); err != nil {
		return err
	}

	batch := new(leveldb.Batch)
	idb := id.ToBytes("kv")
	batch.Put(idb, value)
	if aliases != nil {
		for _, alias := range aliases {
			batch.Put(alias.ToBytes("lo"), idb)
		}
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

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"os"
	"strings"
	"sync"

	"github.com/syndtr/goleveldb/leveldb"
	errors "github.com/syndtr/goleveldb/leveldb/errors"
	"github.com/syndtr/goleveldb/leveldb/opt"
)

// table names
const (
	levelDbTableLo = "lo"
	levelDbTableKv = "kv"
)

type levelDBOps interface {
	Delete(key []byte, wo *opt.WriteOptions) error
	Get(key []byte, ro *opt.ReadOptions) (value []byte, err error)
	Put(key, value []byte, wo *opt.WriteOptions) error
	Write(b *leveldb.Batch, wo *opt.WriteOptions) error
}

func levelDbPut(ops levelDBOps, id DbKey, aliases []DbKey, value []byte) error {
	idb := id.ToBytes(levelDbTableKv)
	if aliases == nil || len(aliases) == 0 {
		// if no aliases, just do a put
		return ops.Put(idb, value, nil)
	}

	batch := new(leveldb.Batch)
	batch.Put(idb, value)
	if aliases != nil {
		for _, alias := range aliases {
			batch.Put(alias.ToBytes(levelDbTableLo), idb)
		}
	}

	return ops.Write(batch, nil)
}

func levelDbGetWhich(ops levelDBOps, id DbKey, which string) (val []byte, found bool, err error) {
	val, err = ops.Get(id.ToBytes(which), nil)
	found = false
	if err == nil {
		found = true
	} else if err == leveldb.ErrNotFound {
		err = nil
	}
	return val, found, err
}

func levelDbGet(ops levelDBOps, id DbKey) (val []byte, found bool, err error) {
	return levelDbGetWhich(ops, id, levelDbTableKv)
}

func levelDbLookup(ops levelDBOps, id DbKey) (val []byte, found bool, err error) {
	val, found, err = levelDbGetWhich(ops, id, levelDbTableLo)
	if found {
		if tab, id2, err2 := DbKeyParse(string(val)); err2 != nil {
			err = err2
		} else if tab != levelDbTableKv {
			err = fmt.Errorf("bad alias; expected 'kv' but got '%s'", tab)
		} else {
			val, found, err = levelDbGetWhich(ops, *id2, levelDbTableKv)
		}
	}
	return val, found, err
}

func levelDbDelete(ops levelDBOps, id DbKey) error {
	return ops.Delete(id.ToBytes(levelDbTableKv), nil)
}

type LevelDb struct {
	// We use a RWMutex here to ensure close doesn't happen in the middle of
	// other DB operations, and DB operations doesn't happen after close. The
	// lock should be considered for the db pointer and dbOpenerOnce pointer,
	// rather than the DB itself.  More specifically, close does Lock(), while
	// other DB operations does RLock().
	sync.RWMutex
	db           *leveldb.DB
	dbOpenerOnce *sync.Once

	filename string
	Contextified
}

func NewLevelDb(g *GlobalContext, filename func() string) *LevelDb {
	return &LevelDb{
		Contextified: NewContextified(g),
		filename:     filename(),
		dbOpenerOnce: new(sync.Once),
	}
}

// Explicit open does nothing we'll wait for a lazy open
func (l *LevelDb) Open() error { return nil }

func (l *LevelDb) Opts() *opt.Options {
	return &opt.Options{
		OpenFilesCacheCapacity: 16, // Only 16 files open by level DB per db
	}
}

func (l *LevelDb) doWhileOpenAndNukeIfCorrupted(action func() error) (err error) {
	err = func() error {
		l.RLock()
		defer l.RUnlock()

		// This only happens at first ever doWhileOpenAndNukeIfCorrupted call, or
		// when doOpenerOnce is just reset in Nuke()
		l.dbOpenerOnce.Do(func() {
			l.G().Log.Debug("+ LevelDb.open")
			fn := l.GetFilename()
			l.G().Log.Debug("| Opening LevelDB for local cache: %v %s", l, fn)
			l.db, err = leveldb.OpenFile(fn, l.Opts())
			if err != nil {
				if _, ok := err.(*errors.ErrCorrupted); ok {
					l.G().Log.Debug("| LevelDB was corrupted; attempting recovery (%v)", err)
					l.db, err = leveldb.RecoverFile(fn, nil)
					if err != nil {
						l.G().Log.Debug("| Recovery failed: %v", err)
					} else {
						l.G().Log.Debug("| Recovery succeeded!")
					}
				}
			}
			l.G().Log.Debug("- LevelDb.open -> %s", ErrToOk(err))
		})

		if err != nil {
			return err
		}

		if l.db == nil {
			// This means DB is already closed. We are preventing lazy-opening after
			// closing, so just return error here.
			return LevelDBOpenClosedError{}
		}

		return action()
	}()

	// If the file is corrupt, just nuke and act like we didn't find anything
	if l.nukeIfCorrupt(err) {
		err = nil
	}

	// Notably missing here is the error handling for when DB open fails but on
	// an error other than "db is corrupted". We simply return the error here
	// without resetting `dbOpenerOcce` (i.e. next call into LevelDb would result
	// in a LevelDBOpenClosedError), because if DB open fails, retrying it
	// wouldn't help. We should find the root cause and deal with it.

	return err
}

// ForceOpen opens the leveldb file.  This is used in situations
// where we want to get around the lazy open and make sure we can
// use it later.
func (l *LevelDb) ForceOpen() error {
	return l.doWhileOpenAndNukeIfCorrupted(func() error { return nil })
}

func (l *LevelDb) GetFilename() string {
	if len(l.filename) == 0 {
		l.G().Log.Fatalf("DB filename empty")
	}
	return l.filename
}

func (l *LevelDb) Close() error {
	l.Lock()
	defer l.Unlock()
	return l.closeLocked()
}

func (l *LevelDb) closeLocked() error {
	var err error
	if l.db != nil {
		l.G().Log.Debug("Closing LevelDB local cache: %s", l.GetFilename())
		err = l.db.Close()
		l.db = nil

		// In case we just nuked DB and reset the dbOpenerOnce, this makes sure it
		// doesn't open the DB again.
		l.dbOpenerOnce.Do(func() {})
	}
	return err
}

func (l *LevelDb) isCorrupt(err error) bool {
	if err == nil {
		return false
	}

	// If the error is of type ErrCorrupted, then we nuke
	if _, ok := err.(*errors.ErrCorrupted); ok {
		return true
	}

	// Sometimes the LevelDB library will return generic error messages about
	// corruption, also nuke on them
	if strings.Contains(err.Error(), "corrupt") {
		return true
	}

	return false
}

func (l *LevelDb) Nuke() (fn string, err error) {
	l.Lock()
	// We need to do defered Unlock here in Nuke rather than delegating to
	// l.Close() because we'll be re-opening the database later, and it's
	// necesary to block other doWhileOpenAndNukeIfCorrupted() calls.
	defer l.Unlock()
	defer l.G().Trace("LevelDb::Nuke", func() error { return err })()

	err = l.closeLocked()
	if err != nil {
		return "", err
	}

	fn = l.GetFilename()
	err = os.RemoveAll(fn)
	if err != nil {
		return fn, err
	}
	// reset dbOpenerOnce since this is not a explicit close and there might be
	// more legitimate DB operations coming in
	l.dbOpenerOnce = new(sync.Once)
	return fn, err
}

func (l *LevelDb) nukeIfCorrupt(err error) bool {
	if l.isCorrupt(err) {
		l.G().Log.Debug("LevelDB file corrupted, nuking database and starting fresh")
		if _, err := l.Nuke(); err != nil {
			l.G().Log.Debug("Error nuking LevelDB file: %s", err)
			return false
		}
		return true
	}
	return false
}

func (l *LevelDb) Put(id DbKey, aliases []DbKey, value []byte) error {
	return l.doWhileOpenAndNukeIfCorrupted(func() error {
		return levelDbPut(l.db, id, aliases, value)
	})
}

func (l *LevelDb) Get(id DbKey) (val []byte, found bool, err error) {
	err = l.doWhileOpenAndNukeIfCorrupted(func() error {
		val, found, err = levelDbGet(l.db, id)
		return err
	})

	return val, found, err
}

func (l *LevelDb) Lookup(id DbKey) (val []byte, found bool, err error) {
	err = l.doWhileOpenAndNukeIfCorrupted(func() error {
		val, found, err = levelDbLookup(l.db, id)
		return err
	})

	return val, found, err
}

func (l *LevelDb) Delete(id DbKey) error {
	err := l.doWhileOpenAndNukeIfCorrupted(func() error {
		return levelDbDelete(l.db, id)
	})

	return err
}

func (l *LevelDb) OpenTransaction() (LocalDbTransaction, error) {
	var (
		ltr LevelDbTransaction
		err error
	)
	if ltr.tr, err = l.db.OpenTransaction(); err != nil {
		return LevelDbTransaction{}, err
	}
	return ltr, nil
}

type LevelDbTransaction struct {
	tr *leveldb.Transaction
}

func (l LevelDbTransaction) Put(id DbKey, aliases []DbKey, value []byte) error {
	return levelDbPut(l.tr, id, aliases, value)
}

func (l LevelDbTransaction) Get(id DbKey) (val []byte, found bool, err error) {
	return levelDbGet(l.tr, id)
}

func (l LevelDbTransaction) Lookup(id DbKey) (val []byte, found bool, err error) {
	return levelDbLookup(l.tr, id)
}

func (l LevelDbTransaction) Delete(id DbKey) error {
	return levelDbDelete(l.tr, id)
}

func (l LevelDbTransaction) Commit() error {
	return l.tr.Commit()
}

func (l LevelDbTransaction) Discard() {
	l.tr.Discard()
}

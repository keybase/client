// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/syndtr/goleveldb/leveldb"
	errors "github.com/syndtr/goleveldb/leveldb/errors"
	"github.com/syndtr/goleveldb/leveldb/filter"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/util"
	"golang.org/x/net/context"
)

// table names
const (
	levelDbTableLo = "lo"
	levelDbTableKv = "kv"
	// keys with this prefix are ignored by the dbcleaner
	levelDbTablePerm = "pm"
)

type levelDBOps interface {
	Delete(key []byte, wo *opt.WriteOptions) error
	Get(key []byte, ro *opt.ReadOptions) (value []byte, err error)
	Put(key, value []byte, wo *opt.WriteOptions) error
	Write(b *leveldb.Batch, wo *opt.WriteOptions) error
}

func LevelDbPrefix(typ ObjType) []byte {
	return []byte(PrefixString(levelDbTableKv, typ))
}

func levelDbPut(ops levelDBOps, cleaner *levelDbCleaner, id DbKey, aliases []DbKey, value []byte) (err error) {
	defer convertNoSpaceError(err)

	idb := id.ToBytes(levelDbTableKv)
	if aliases == nil {
		// if no aliases, just do a put
		if err := ops.Put(idb, value, nil); err != nil {
			return err
		}
		cleaner.markRecentlyUsed(context.Background(), idb)
		return nil
	}

	batch := new(leveldb.Batch)
	batch.Put(idb, value)
	keys := make([][]byte, len(aliases))
	keys = append(keys, idb)
	for i, alias := range aliases {
		aliasKey := alias.ToBytes(levelDbTableLo)
		batch.Put(aliasKey, idb)
		keys[i] = aliasKey
	}

	if err := ops.Write(batch, nil); err != nil {
		return err
	}
	for _, key := range keys {
		cleaner.markRecentlyUsed(context.Background(), key)
	}
	return nil
}

func levelDbGetWhich(ops levelDBOps, cleaner *levelDbCleaner, id DbKey, which string) (val []byte, found bool, err error) {
	key := id.ToBytes(which)
	val, err = ops.Get(key, nil)
	found = false
	if err == nil {
		found = true
	} else if err == leveldb.ErrNotFound {
		err = nil
	}

	if found && err == nil {
		cleaner.markRecentlyUsed(context.Background(), key)
	}
	return val, found, err
}

func levelDbGet(ops levelDBOps, cleaner *levelDbCleaner, id DbKey) ([]byte, bool, error) {
	return levelDbGetWhich(ops, cleaner, id, levelDbTableKv)
}

func levelDbLookup(ops levelDBOps, cleaner *levelDbCleaner, id DbKey) (val []byte, found bool, err error) {
	val, found, err = levelDbGetWhich(ops, cleaner, id, levelDbTableLo)
	if found {
		if tab, id2, err2 := DbKeyParse(string(val)); err2 != nil {
			err = err2
		} else if tab != levelDbTableKv && tab != levelDbTablePerm {
			err = fmt.Errorf("bad alias; expected 'kv' but got '%s'", tab)
		} else {
			val, found, err = levelDbGetWhich(ops, cleaner, id2, tab)
		}
	}
	return val, found, err
}

func levelDbDelete(ops levelDBOps, cleaner *levelDbCleaner, id DbKey) (err error) {
	defer convertNoSpaceError(err)
	key := id.ToBytes(levelDbTableKv)
	if err := ops.Delete(key, nil); err != nil {
		return err
	}

	cleaner.removeRecentlyUsed(context.Background(), key)
	return nil
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
	cleaner      *levelDbCleaner

	filename string
	Contextified
}

func NewLevelDb(g *GlobalContext, filename func() string) *LevelDb {
	path := filename()
	return &LevelDb{
		Contextified: NewContextified(g),
		filename:     path,
		dbOpenerOnce: new(sync.Once),
		cleaner:      newLevelDbCleaner(NewMetaContextTODO(g), filepath.Base(path)),
	}
}

// Explicit open does nothing we'll wait for a lazy open
func (l *LevelDb) Open() error { return nil }

// Opts returns the options for all leveldb databases.
//
// PC: I think it's worth trying a bloom filter.  From docs:
// "In many cases, a filter can cut down the number of disk
// seeks from a handful to a single disk seek per DB.Get call."
func (l *LevelDb) Opts() *opt.Options {
	return &opt.Options{
		OpenFilesCacheCapacity: l.G().Env.GetLevelDBNumFiles(),
		Filter:                 filter.NewBloomFilter(10),
		CompactionTableSize:    10 * opt.MiB,
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
			l.G().Log.Debug("| Opening LevelDB options: %+v", l.Opts())
			l.db, err = leveldb.OpenFile(fn, l.Opts())
			if err != nil {
				if _, ok := err.(*errors.ErrCorrupted); ok {
					l.G().Log.Debug("| LevelDb was corrupted; attempting recovery (%v)", err)
					l.db, err = leveldb.RecoverFile(fn, nil)
					if err != nil {
						l.G().Log.Debug("| Recovery failed: %v", err)
					} else {
						l.G().Log.Debug("| Recovery succeeded!")
					}
				}
			}
			l.G().Log.Debug("- LevelDb.open -> %s", ErrToOk(err))
			if l.db != nil {
				l.cleaner.setDb(l.db)
			}
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
	} else if IsNoSpaceOnDeviceError(err) {
		// If we are out of space force a db clean
		go l.cleaner.clean(true)
	}

	// Notably missing here is the error handling for when DB open fails but on
	// an error other than "db is corrupted". We simply return the error here
	// without resetting `dbOpenerOnce` (i.e. next call into LevelDb would result
	// in a LevelDBOpenClosedError), because if DB open fails, retrying it
	// wouldn't help. We should find the root cause and deal with it.
	// MM: 10/12/2017: I am changing the above policy. I am not so sure retrying it won't help,
	// we should at least try instead of auto returning LevelDBOpenClosederror.
	if err != nil {
		l.Lock()
		if l.db == nil {
			l.G().Log.Debug("LevelDb: doWhileOpenAndNukeIfCorrupted: resetting sync one: %s", err)
			l.dbOpenerOnce = new(sync.Once)
		}
		l.Unlock()
	}
	return err
}

// ForceOpen opens the leveldb file.  This is used in situations
// where we want to get around the lazy open and make sure we can
// use it later.
func (l *LevelDb) ForceOpen() error {
	return l.doWhileOpenAndNukeIfCorrupted(func() error { return nil })
}

func (l *LevelDb) Stats() (stats string) {
	if err := l.doWhileOpenAndNukeIfCorrupted(func() (err error) {
		stats, err = l.db.GetProperty("leveldb.stats")
		stats = fmt.Sprintf("%s\n%s", stats, l.cleaner.Status())
		return err
	}); err != nil {
		return ""
	}
	return stats
}

func (l *LevelDb) CompactionStats() (memActive, tableActive bool, err error) {
	var dbStats leveldb.DBStats
	if err := l.doWhileOpenAndNukeIfCorrupted(func() (err error) {
		return l.db.Stats(&dbStats)
	}); err != nil {
		return false, false, err
	}
	return dbStats.MemCompactionActive, dbStats.TableCompactionActive, nil
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
		// stop any active cleaning jobs
		l.cleaner.Stop()
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
	// if our db is in a bad state with too many open files also nuke
	if strings.Contains(strings.ToLower(err.Error()), "too many open files") {
		return true
	}
	return false
}

func (l *LevelDb) Clean(force bool) (err error) {
	l.Lock()
	defer l.Unlock()
	defer l.G().Trace("LevelDb::Clean", func() error { return err })()
	return l.cleaner.clean(force)
}

func (l *LevelDb) Nuke() (fn string, err error) {
	l.Lock()
	// We need to do deferred Unlock here in Nuke rather than delegating to
	// l.Close() because we'll be re-opening the database later, and it's
	// necessary to block other doWhileOpenAndNukeIfCorrupted() calls.
	defer l.Unlock()
	defer l.G().Trace("LevelDb::Nuke", func() error { return err })()

	// even if we can't close the db try to nuke the files directly
	if err = l.closeLocked(); err != nil {
		l.G().Log.Debug("Error closing leveldb %v, attempting nuke anyway", err)
	}

	fn = l.GetFilename()
	if err = os.RemoveAll(fn); err != nil {
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
		return levelDbPut(l.db, l.cleaner, id, aliases, value)
	})
}

func (l *LevelDb) Get(id DbKey) (val []byte, found bool, err error) {
	err = l.doWhileOpenAndNukeIfCorrupted(func() error {
		val, found, err = levelDbGet(l.db, l.cleaner, id)
		return err
	})
	return val, found, err
}

func (l *LevelDb) Lookup(id DbKey) (val []byte, found bool, err error) {
	err = l.doWhileOpenAndNukeIfCorrupted(func() error {
		val, found, err = levelDbLookup(l.db, l.cleaner, id)
		return err
	})
	return val, found, err
}

func (l *LevelDb) Delete(id DbKey) error {
	return l.doWhileOpenAndNukeIfCorrupted(func() error {
		return levelDbDelete(l.db, l.cleaner, id)
	})
}

func (l *LevelDb) OpenTransaction() (LocalDbTransaction, error) {
	var (
		ltr LevelDbTransaction
		err error
	)
	if ltr.tr, err = l.db.OpenTransaction(); err != nil {
		return LevelDbTransaction{}, err
	}
	ltr.cleaner = l.cleaner
	return ltr, nil
}

func (l *LevelDb) KeysWithPrefixes(prefixes ...[]byte) (DBKeySet, error) {
	m := make(map[DbKey]bool)

	l.Lock()
	defer l.Unlock()

	opts := &opt.ReadOptions{DontFillCache: true}
	for _, prefix := range prefixes {
		iter := l.db.NewIterator(util.BytesPrefix(prefix), opts)
		for iter.Next() {
			_, dbKey, err := DbKeyParse(string(iter.Key()))
			if err != nil {
				iter.Release()
				return m, err
			}
			m[dbKey] = true
		}
		iter.Release()
		err := iter.Error()
		if err != nil {
			return nil, nil
		}
	}

	return m, nil
}

type LevelDbTransaction struct {
	tr      *leveldb.Transaction
	cleaner *levelDbCleaner
}

func (l LevelDbTransaction) Put(id DbKey, aliases []DbKey, value []byte) error {
	return levelDbPut(l.tr, l.cleaner, id, aliases, value)
}

func (l LevelDbTransaction) Get(id DbKey) (val []byte, found bool, err error) {
	return levelDbGet(l.tr, l.cleaner, id)
}

func (l LevelDbTransaction) Lookup(id DbKey) (val []byte, found bool, err error) {
	return levelDbLookup(l.tr, l.cleaner, id)
}

func (l LevelDbTransaction) Delete(id DbKey) error {
	return levelDbDelete(l.tr, l.cleaner, id)
}

func (l LevelDbTransaction) Commit() (err error) {
	defer convertNoSpaceError(err)
	return l.tr.Commit()
}

func (l LevelDbTransaction) Discard() {
	l.tr.Discard()
}

func convertNoSpaceError(err error) error {
	if IsNoSpaceOnDeviceError(err) {
		// embed in exportable error type
		err = NoSpaceOnDeviceError{Desc: err.Error()}
	}

	return err
}

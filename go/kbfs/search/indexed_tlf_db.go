// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"io"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/ldbutils"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	"github.com/syndtr/goleveldb/leveldb/storage"
)

const (
	initialIndexedTlfsDbVersion uint64 = 1
	currentIndexedTlfsDbVersion uint64 = initialIndexedTlfsDbVersion
	indexedTlfsFolderName       string = "indexed_tlfs"
)

// IndexedTlfDb is a database that holds metadata about indexed TLFs.
type IndexedTlfDb struct {
	config libkbfs.Config
	log    logger.Logger

	// Protect the DB from being shutdown while they're being
	// accessed, and mutable data.
	lock  sync.RWMutex
	tlfDb *ldbutils.LevelDb // tlfID -> TLF metadata.

	shutdownCh chan struct{}

	closer func()
}

// newIndexedTlfDbFromStorage creates a new *IndexedTlfDb with the
// passed-in storage.Storage interfaces as a storage layers for the db.
func newIndexedTlfDbFromStorage(
	config libkbfs.Config, tlfStorage storage.Storage) (
	db *IndexedTlfDb, err error) {
	log := config.MakeLogger("ITD")
	closers := make([]io.Closer, 0, 1)
	closer := func() {
		for _, c := range closers {
			closeErr := c.Close()
			if closeErr != nil {
				log.Warning("Error closing leveldb or storage: %+v", closeErr)
			}
		}
	}
	defer func() {
		if err != nil {
			err = errors.WithStack(err)
			closer()
		}
	}()

	tlfDbOptions := ldbutils.LeveldbOptions(config.Mode())
	tlfDb, err := ldbutils.OpenLevelDbWithOptions(tlfStorage, tlfDbOptions)
	if err != nil {
		return nil, err
	}
	closers = append(closers, tlfDb)

	return &IndexedTlfDb{
		config:     config,
		tlfDb:      tlfDb,
		shutdownCh: make(chan struct{}),
		closer:     closer,
	}, nil
}

// newIndexedTlfDb creates a new *IndexedTlfDb with a
// specified directory on the filesystem as storage.
func newIndexedTlfDb(config libkbfs.Config, dirPath string) (
	db *IndexedTlfDb, err error) {
	log := config.MakeLogger("ITD")
	defer func() {
		if err != nil {
			log.Error("Error initializing indexed TLF db: %+v", err)
		}
	}()
	dbPath := filepath.Join(dirPath, indexedTlfsFolderName)
	versionPath, err := ldbutils.GetVersionedPathForDb(
		log, dbPath, "indexed TLFs", currentIndexedTlfsDbVersion)
	if err != nil {
		return nil, err
	}
	tlfDbPath := filepath.Join(versionPath, tlfDbFilename)
	tlfStorage, err := storage.OpenFile(tlfDbPath, false)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			tlfStorage.Close()
		}
	}()
	return newIndexedTlfDbFromStorage(config, tlfStorage)
}

type tlfMD struct {
	// Exported only for serialization.
	IndexedRevision kbfsmd.Revision `codec:"i"`
	StartedRevision kbfsmd.Revision `codec:"s"`
}

// getMetadataLocked retrieves the metadata for a block in the db, or
// returns leveldb.ErrNotFound and a zero-valued metadata otherwise.
func (db *IndexedTlfDb) getMetadataLocked(tlfID tlf.ID) (
	metadata tlfMD, err error) {
	metadataBytes, err := db.tlfDb.Get(tlfID.Bytes(), nil)
	if err != nil {
		return tlfMD{}, err
	}
	err = db.config.Codec().Decode(metadataBytes, &metadata)
	if err != nil {
		return tlfMD{}, err
	}
	return metadata, nil
}

// checkAndLockDb checks whether the db is started.
func (db *IndexedTlfDb) checkDbLocked(
	ctx context.Context, method string) error {
	// First see if the context has expired since we began.
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// shutdownCh has to be checked under lock, otherwise we can race.
	select {
	case <-db.shutdownCh:
		return errors.WithStack(DbClosedError{method})
	default:
	}
	if db.tlfDb == nil {
		return errors.WithStack(DbClosedError{method})
	}
	return nil
}

// Get returns the revisions for the given TLF.
func (db *IndexedTlfDb) Get(
	ctx context.Context, tlfID tlf.ID) (
	indexedRev, startedRev kbfsmd.Revision, err error) {
	db.lock.RLock()
	defer db.lock.RUnlock()
	err = db.checkDbLocked(ctx, "ITD(Get)")
	if err != nil {
		return kbfsmd.RevisionUninitialized, kbfsmd.RevisionUninitialized, err
	}

	md, err := db.getMetadataLocked(tlfID)
	if err != nil {
		return kbfsmd.RevisionUninitialized, kbfsmd.RevisionUninitialized, err
	}
	return md.IndexedRevision, md.StartedRevision, nil
}

// Put saves the revisions for the given TLF.
func (db *IndexedTlfDb) Put(
	ctx context.Context, tlfID tlf.ID,
	indexedRev, startedRev kbfsmd.Revision) error {
	db.lock.Lock()
	defer db.lock.Unlock()
	err := db.checkDbLocked(ctx, "ITD(Put)")
	if err != nil {
		return err
	}

	md := tlfMD{
		IndexedRevision: indexedRev,
		StartedRevision: startedRev,
	}
	encodedMetadata, err := db.config.Codec().Encode(&md)
	if err != nil {
		return err
	}

	return db.tlfDb.Put(tlfID.Bytes(), encodedMetadata, nil)
}

// Delete removes the metadata for the TLF from the DB.
func (db *IndexedTlfDb) Delete(
	ctx context.Context, tlfID tlf.ID) error {
	db.lock.Lock()
	defer db.lock.Unlock()
	err := db.checkDbLocked(ctx, "ITD(Delete)")
	if err != nil {
		return err
	}

	return db.tlfDb.Delete(tlfID.Bytes(), nil)
}

// Shutdown closes this db.
func (db *IndexedTlfDb) Shutdown(ctx context.Context) {
	db.lock.Lock()
	defer db.lock.Unlock()
	// shutdownCh has to be checked under lock, otherwise we can race.
	select {
	case <-db.shutdownCh:
		db.log.CWarningf(ctx, "Shutdown called more than once")
		return
	default:
	}
	close(db.shutdownCh)
	if db.tlfDb == nil {
		return
	}
	db.closer()
	db.tlfDb = nil
}

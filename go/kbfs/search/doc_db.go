// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"io"
	"sync"

	"github.com/keybase/client/go/kbfs/ldbutils"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	"github.com/syndtr/goleveldb/leveldb/storage"
	billy "gopkg.in/src-d/go-billy.v4"
)

// DocDb is a database that holds metadata about indexed documents.
type DocDb struct {
	config libkbfs.Config
	log    logger.Logger

	// Protect the DB from being shutdown while they're being
	// accessed, and mutable data.
	lock sync.RWMutex
	db   *ldbutils.LevelDb // docID -> doc metadata.

	shutdownCh chan struct{}

	closer func()
}

// newDocDbFromStorage creates a new *DocDb with the passed-in
// storage.Storage interface as the storage layer for the db.
func newDocDbFromStorage(config libkbfs.Config, s storage.Storage) (
	db *DocDb, err error) {
	log := config.MakeLogger("DD")
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

	dbOptions := ldbutils.LeveldbOptions(config.Mode())
	docDb, err := ldbutils.OpenLevelDbWithOptions(s, dbOptions)
	if err != nil {
		return nil, err
	}
	closers = append(closers, docDb)

	return &DocDb{
		config:     config,
		db:         docDb,
		shutdownCh: make(chan struct{}),
		closer:     closer,
	}, nil
}

// newDocDb creates a new *DocDb with a
// specified billy filesystem as the storage layer.
func newDocDb(config libkbfs.Config, fs billy.Filesystem) (
	db *DocDb, err error) {
	log := config.MakeLogger("DD")
	defer func() {
		if err != nil {
			log.Error("Error initializing doc db: %+v", err)
		}
	}()

	s, err := libfs.OpenLevelDBStorage(fs, false)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err != nil {
			s.Close()
		}
	}()
	return newDocDbFromStorage(config, s)
}

type docMD struct {
	// Exported only for serialization.
	ParentDocID string `codec:"p"`
	Name        string `codec:"n"`
}

// getMetadataLocked retrieves the metadata for a doc in the db, or
// returns leveldb.ErrNotFound and a zero-valued metadata otherwise.
func (db *DocDb) getMetadataLocked(docID string) (md docMD, err error) {
	mdBytes, err := db.db.Get([]byte(docID), nil)
	if err != nil {
		return docMD{}, err
	}
	err = db.config.Codec().Decode(mdBytes, &md)
	if err != nil {
		return docMD{}, err
	}
	return md, nil
}

// checkAndLockDb checks whether the db is started.
func (db *DocDb) checkDbLocked(
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
	if db.db == nil {
		return errors.WithStack(DbClosedError{method})
	}
	return nil
}

// Get returns the info for the given doc.
func (db *DocDb) Get(ctx context.Context, docID string) (
	parentDocID, name string, err error) {
	db.lock.RLock()
	defer db.lock.RUnlock()
	err = db.checkDbLocked(ctx, "DD(Get)")
	if err != nil {
		return "", "", err
	}

	md, err := db.getMetadataLocked(docID)
	if err != nil {
		return "", "", err
	}
	return md.ParentDocID, md.Name, nil
}

// Put saves the revisions for the given TLF.
func (db *DocDb) Put(
	ctx context.Context, docID, parentDocID, name string) error {
	db.lock.Lock()
	defer db.lock.Unlock()
	err := db.checkDbLocked(ctx, "DD(Put)")
	if err != nil {
		return err
	}

	md := docMD{
		ParentDocID: parentDocID,
		Name:        name,
	}
	encodedMetadata, err := db.config.Codec().Encode(&md)
	if err != nil {
		return err
	}

	return db.db.Put([]byte(docID), encodedMetadata, nil)
}

// Delete removes the metadata for the TLF from the DB.
func (db *DocDb) Delete(
	ctx context.Context, docID string) error {
	db.lock.Lock()
	defer db.lock.Unlock()
	err := db.checkDbLocked(ctx, "DD(Delete)")
	if err != nil {
		return err
	}

	return db.db.Delete([]byte(docID), nil)
}

// Shutdown closes this db.
func (db *DocDb) Shutdown(ctx context.Context) {
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
	if db.db == nil {
		return
	}
	db.closer()
	db.db = nil
}

// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strconv"
	"sync"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/ldbutils"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	ldberrors "github.com/syndtr/goleveldb/leveldb/errors"
	"github.com/syndtr/goleveldb/leveldb/storage"
)

const (
	blockDbFilename               string = "block.leveldb"
	tlfDbFilename                 string = "tlf.leveldb"
	initialIndexedBlocksDbVersion uint64 = 1
	currentIndexedBlocksDbVersion uint64 = initialIndexedBlocksDbVersion
	indexedBlocksFolderName       string = "indexed_blocks"
	indexedBlocksMDKey            string = "--md--"
)

// IndexedBlockDb is a database that holds metadata about indexed blocks.
type IndexedBlockDb struct {
	config libkbfs.Config
	log    logger.Logger

	// Track the cache hit rate and eviction rate
	hitMeter    *ldbutils.CountMeter
	missMeter   *ldbutils.CountMeter
	putMeter    *ldbutils.CountMeter
	deleteMeter *ldbutils.CountMeter

	// Protect the DB from being shutdown while they're being
	// accessed, and mutable data.
	lock            sync.RWMutex
	blockDb         *ldbutils.LevelDb // blockID -> index-related metadata
	bufferedBlockDb *ldbutils.LevelDb // in-memory buffer for block db
	tlfDb           *ldbutils.LevelDb // tlfID+blockID -> nil (for cleanup when TLF is un-indexed)

	docIDLock sync.Mutex
	maxDocID  int64

	shutdownCh chan struct{}

	closer func()
}

// newIndexedBlockDbFromStorage creates a new *IndexedBlockDb
// with the passed-in storage.Storage interfaces as storage layers for each
// db.
func newIndexedBlockDbFromStorage(
	config libkbfs.Config, blockStorage, tlfStorage storage.Storage) (
	db *IndexedBlockDb, err error) {
	log := config.MakeLogger("IBD")
	closers := make([]io.Closer, 0, 2)
	closer := func() {
		for _, c := range closers {
			closeErr := c.Close()
			if closeErr != nil {
				log.Warning("Error closing leveldb or storage: %+v", closeErr)
			}
		}
		if db != nil && db.bufferedBlockDb != nil {
			closeErr := db.bufferedBlockDb.Close()
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
	blockDbOptions := ldbutils.LeveldbOptions(config.Mode())
	blockDb, err := ldbutils.OpenLevelDbWithOptions(
		blockStorage, blockDbOptions)
	if err != nil {
		return nil, err
	}
	closers = append(closers, blockDb)

	tlfDbOptions := ldbutils.LeveldbOptions(config.Mode())
	tlfDb, err := ldbutils.OpenLevelDbWithOptions(tlfStorage, tlfDbOptions)
	if err != nil {
		return nil, err
	}
	closers = append(closers, tlfDb)

	bufferedBlockDb, err := ldbutils.OpenLevelDbWithOptions(
		storage.NewMemStorage(), nil)
	if err != nil {
		return nil, err
	}

	db = &IndexedBlockDb{
		config:          config,
		hitMeter:        ldbutils.NewCountMeter(),
		missMeter:       ldbutils.NewCountMeter(),
		putMeter:        ldbutils.NewCountMeter(),
		deleteMeter:     ldbutils.NewCountMeter(),
		log:             log,
		blockDb:         blockDb,
		bufferedBlockDb: bufferedBlockDb,
		tlfDb:           tlfDb,
		shutdownCh:      make(chan struct{}),
		closer:          closer,
	}

	err = db.loadMaxDocID()
	if err != nil {
		return nil, err
	}

	return db, nil
}

// newIndexedBlockDb creates a new *IndexedBlockDb with a
// specified directory on the filesystem as storage.
func newIndexedBlockDb(config libkbfs.Config, dirPath string) (
	db *IndexedBlockDb, err error) {
	log := config.MakeLogger("IBD")
	defer func() {
		if err != nil {
			log.Error("Error initializing indexed block db: %+v", err)
		}
	}()
	dbPath := filepath.Join(dirPath, indexedBlocksFolderName)
	versionPath, err := ldbutils.GetVersionedPathForDb(
		log, dbPath, "indexed blocks", currentIndexedBlocksDbVersion)
	if err != nil {
		return nil, err
	}
	blockDbPath := filepath.Join(versionPath, blockDbFilename)
	blockStorage, err := storage.OpenFile(blockDbPath, false)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			blockStorage.Close()
		}
	}()
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
	return newIndexedBlockDbFromStorage(config, blockStorage, tlfStorage)
}

// indexedBlocksMD is metadata related to the entire indexed blocks DB.
type indexedBlocksMD struct {
	// Exported only for serialization.
	MaxDocID int64 // stored as int here for easy incrementing
}

func (db *IndexedBlockDb) loadMaxDocID() error {
	db.docIDLock.Lock()
	defer db.docIDLock.Unlock()

	mdBytes, err := db.blockDb.Get([]byte(indexedBlocksMDKey), nil)
	switch errors.Cause(err) {
	case nil:
	case ldberrors.ErrNotFound:
		// Leave the current ID as 0.
		return nil
	default:
		return err
	}

	var md indexedBlocksMD
	err = db.config.Codec().Decode(mdBytes, &md)
	if err != nil {
		return err
	}

	db.maxDocID = md.MaxDocID
	return nil
}

// GetNextDocIDs generates and reserves the next N doc IDs.
func (db *IndexedBlockDb) GetNextDocIDs(n int) ([]string, error) {
	db.docIDLock.Lock()
	defer db.docIDLock.Unlock()

	res := make([]string, n)
	for i := 0; i < n; i++ {
		res[i] = strconv.FormatInt(db.maxDocID+int64(i+1), 16)
	}

	md := indexedBlocksMD{MaxDocID: db.maxDocID + int64(n)}
	encodedMD, err := db.config.Codec().Encode(&md)
	if err != nil {
		return nil, err
	}

	err = db.blockDb.Put([]byte(indexedBlocksMDKey), encodedMD, nil)
	if err != nil {
		return nil, err
	}

	db.maxDocID = md.MaxDocID
	return res, nil
}

// blockMD is per-block metadata for an individual indexed block.
type blockMD struct {
	// Exported only for serialization.
	IndexVersion uint64 `codec:"i"`
	DocID        string `codec:"d"`
	DirDone      bool   `codec:"dd,omitempty"`
}

func blockDbKeyString(ptr data.BlockPointer) string {
	nonce := ptr.RefNonce
	if nonce == kbfsblock.ZeroRefNonce {
		return ptr.ID.String()
	}
	return ptr.ID.String() + nonce.String()
}

func blockDbKey(ptr data.BlockPointer) []byte {
	return []byte(blockDbKeyString(ptr))
}

func tlfKey(tlfID tlf.ID, ptr data.BlockPointer) []byte {
	return []byte(tlfID.String() + blockDbKeyString(ptr))
}

// getMetadataLocked retrieves the metadata for a block in the db, or
// returns leveldb.ErrNotFound and a zero-valued metadata otherwise.
func (db *IndexedBlockDb) getMetadataLocked(
	ptr data.BlockPointer, metered bool) (metadata blockMD, err error) {
	var hitMeter, missMeter *ldbutils.CountMeter
	if metered {
		hitMeter = db.hitMeter
		missMeter = db.missMeter
	}

	metadataBytes, err := db.bufferedBlockDb.GetWithMeter(
		blockDbKey(ptr), hitMeter, missMeter)
	switch errors.Cause(err) {
	case nil:
	case ldberrors.ErrNotFound:
		metadataBytes = nil
	default:
		return blockMD{}, err
	}

	if metadataBytes == nil {
		metadataBytes, err = db.blockDb.GetWithMeter(
			blockDbKey(ptr), hitMeter, missMeter)
		if err != nil {
			return blockMD{}, err
		}
	}

	err = db.config.Codec().Decode(metadataBytes, &metadata)
	if err != nil {
		return blockMD{}, err
	}
	return metadata, nil
}

// DbClosedError indicates that the DB has been closed, and thus isn't
// accepting any more operations.
type DbClosedError struct {
	op string
}

// Error implements the error interface for DbClosedError.
func (e DbClosedError) Error() string {
	return fmt.Sprintf("Error performing %s operation: the db is "+
		"closed", e.op)
}

// checkAndLockDb checks whether the db is started.
func (db *IndexedBlockDb) checkDbLocked(
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
	if db.blockDb == nil || db.tlfDb == nil {
		return errors.WithStack(DbClosedError{method})
	}
	return nil
}

// Get returns the version and doc ID for the given block.
func (db *IndexedBlockDb) Get(
	ctx context.Context, ptr data.BlockPointer) (
	indexVersion uint64, docID string, dirDone bool, err error) {
	db.lock.RLock()
	defer db.lock.RUnlock()
	err = db.checkDbLocked(ctx, "IBD(Get)")
	if err != nil {
		return 0, "", false, err
	}

	md, err := db.getMetadataLocked(ptr, ldbutils.Metered)
	if err != nil {
		return 0, "", false, err
	}
	return md.IndexVersion, md.DocID, md.DirDone, nil
}

func (db *IndexedBlockDb) putLocked(
	ctx context.Context, blockDb *ldbutils.LevelDb, tlfID tlf.ID,
	ptr data.BlockPointer, indexVersion uint64, docID string,
	dirDone bool) error {
	md := blockMD{
		IndexVersion: indexVersion,
		DocID:        docID,
		DirDone:      dirDone,
	}
	encodedMetadata, err := db.config.Codec().Encode(&md)
	if err != nil {
		return err
	}

	return blockDb.PutWithMeter(
		blockDbKey(ptr), encodedMetadata, db.putMeter)
}

// Put saves the version and doc ID for the given block.
func (db *IndexedBlockDb) Put(
	ctx context.Context, tlfID tlf.ID, ptr data.BlockPointer,
	indexVersion uint64, docID string, dirDone bool) error {
	db.lock.Lock()
	defer db.lock.Unlock()
	err := db.checkDbLocked(ctx, "IBD(Put)")
	if err != nil {
		return err
	}

	err = db.putLocked(
		ctx, db.blockDb, tlfID, ptr, indexVersion, docID, dirDone)
	if err != nil {
		return err
	}

	// Record the tlf+blockID, so we can iterate the blocks if we ever
	// need to delete all the blocks associated with a TLF.
	return db.tlfDb.Put(tlfKey(tlfID, ptr), []byte{}, nil)
}

// PutMemory saves the data to memory, and returns a function that
// will flush it to disk when the caller is ready.
func (db *IndexedBlockDb) PutMemory(
	ctx context.Context, tlfID tlf.ID, ptr data.BlockPointer,
	indexVersion uint64, docID string, dirDone bool) (
	flushFn func() error, err error) {
	db.lock.Lock()
	defer db.lock.Unlock()

	err = db.checkDbLocked(ctx, "IBD(PutMemory)")
	if err != nil {
		return nil, err
	}

	err = db.putLocked(
		ctx, db.bufferedBlockDb, tlfID, ptr, indexVersion, docID, dirDone)
	if err != nil {
		return nil, err
	}

	return func() error {
		return db.Put(ctx, tlfID, ptr, indexVersion, docID, dirDone)
	}, nil
}

// ClearMemory clears out the buffered puts from memory.
func (db *IndexedBlockDb) ClearMemory() error {
	db.lock.Lock()
	defer db.lock.Unlock()

	bufferedBlockDb, err := ldbutils.OpenLevelDbWithOptions(
		storage.NewMemStorage(), nil)
	if err != nil {
		return err
	}

	if bufferedBlockDb != nil {
		err := db.bufferedBlockDb.Close()
		if err != nil {
			return err
		}
	}

	db.bufferedBlockDb = bufferedBlockDb
	return nil
}

// Delete removes the metadata for the block pointer from the DB.
func (db *IndexedBlockDb) Delete(
	ctx context.Context, tlfID tlf.ID, ptr data.BlockPointer) error {
	db.lock.Lock()
	defer db.lock.Unlock()
	err := db.checkDbLocked(ctx, "IBD(Delete)")
	if err != nil {
		return err
	}

	defer func() {
		if err == nil {
			db.deleteMeter.Mark(1)
		}
	}()

	err = db.blockDb.Delete(blockDbKey(ptr), nil)
	if err != nil {
		return err
	}

	return db.tlfDb.Delete(tlfKey(tlfID, ptr), nil)
}

// Shutdown closes this db.
func (db *IndexedBlockDb) Shutdown(ctx context.Context) {
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
	if db.blockDb == nil || db.tlfDb == nil {
		return
	}
	db.closer()
	db.blockDb = nil
	db.tlfDb = nil
	db.hitMeter.Shutdown()
	db.missMeter.Shutdown()
	db.putMeter.Shutdown()
	db.deleteMeter.Shutdown()
}

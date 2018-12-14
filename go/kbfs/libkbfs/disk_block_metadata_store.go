// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/pkg/errors"
	ldberrors "github.com/syndtr/goleveldb/leveldb/errors"
)

type blockMetadataType int

const (
	_ blockMetadataType = iota
	blockMetadataXattr
)

// XattrType represents the xattr type.
type XattrType int

// New types can only be added at end.
const (
	_ XattrType = iota
	XattrAppleQuarantine
)

const (
	initialBlockMetadataStoreVersion uint64 = 1
	currentBlockMetadataStoreVersion uint64 = initialBlockMetadataStoreVersion
	blockMetadataFolderName          string = "kbfs_block_metadata"
	blockMetadataDbFilename          string = "diskBlockMetadata.leveldb"
)

type diskBlockMetadataStoreConfig interface {
	Codec() kbfscodec.Codec
	MakeLogger(module string) logger.Logger
	StorageRoot() string
}

// diskBlockMetadataStore interacts with BlockMetadata data storage on disk.
type diskBlockMetadataStore struct {
	log    logger.Logger
	config diskBlockMetadataStoreConfig

	// Track the hit rate and eviction rate. These are goroutine safe.
	hitMeter  *CountMeter
	missMeter *CountMeter
	putMeter  *CountMeter

	lock       sync.RWMutex
	db         *levelDb
	shutdownCh chan struct{}
}

// newDiskBlockMetadataStore creates a new disk BlockMetadata storage.
func newDiskBlockMetadataStore(
	config diskBlockMetadataStoreConfig) (BlockMetadataStore, error) {
	log := config.MakeLogger("BMS")
	db, err := openVersionedLevelDB(log, config.StorageRoot(),
		blockMetadataFolderName, currentBlockMetadataStoreVersion, blockMetadataDbFilename)
	if err != nil {
		return nil, err
	}
	return &diskBlockMetadataStore{
		log:        log,
		config:     config,
		hitMeter:   NewCountMeter(),
		missMeter:  NewCountMeter(),
		putMeter:   NewCountMeter(),
		db:         db,
		shutdownCh: make(chan struct{}),
	}, err
}

// Shutdown shuts done this storae.
func (s *diskBlockMetadataStore) Shutdown() {
	s.log.Debug("Shutting down diskBlockMetadataStore")
	s.lock.Lock()
	defer s.lock.Unlock()
	// shutdownCh has to be checked under lock, otherwise we can race.
	select {
	case <-s.shutdownCh:
		s.log.Warning("Shutdown called more than once")
	default:
	}
	close(s.shutdownCh)
	if s.db == nil {
		return
	}
	s.db.Close()
	s.db = nil
	s.hitMeter.Shutdown()
	s.missMeter.Shutdown()
	s.putMeter.Shutdown()
}

var _ BlockMetadataStore = (*diskBlockMetadataStore)(nil)

// ErrBlockMetadataStoreShutdown is returned when methods are called on
// diskBlockMetadataStore when it's already shutdown.
type ErrBlockMetadataStoreShutdown struct{}

// Error implements the error interface.
func (ErrBlockMetadataStoreShutdown) Error() string {
	return "disk block metadata store has shutdown"
}

// GetMetadata implements the BlockMetadataStore interface.
func (s *diskBlockMetadataStore) GetMetadata(ctx context.Context,
	blockID kbfsblock.ID) (value BlockMetadataValue, err error) {
	s.lock.RLock()
	defer s.lock.RUnlock()

	select {
	case <-s.shutdownCh:
		return BlockMetadataValue{}, ErrBlockMetadataStoreShutdown{}
	default:
	}

	encoded, err := s.db.GetWithMeter(blockID.Bytes(), s.hitMeter, s.missMeter)
	switch errors.Cause(err) {
	case ldberrors.ErrNotFound:
		return BlockMetadataValue{}, err
	case nil:
		if err = s.config.Codec().Decode(encoded, &value); err != nil {
			s.log.CWarningf(ctx, "decoding block metadata error: %v", err)
			return BlockMetadataValue{}, ldberrors.ErrNotFound
		}
		return value, nil
	default:
		s.log.CWarningf(ctx, "GetMetadata error: %v", err)
		return BlockMetadataValue{}, ldberrors.ErrNotFound
	}
}

// UpdateMetadata implements the BlockMetadataStore interface.
func (s *diskBlockMetadataStore) UpdateMetadata(ctx context.Context,
	blockID kbfsblock.ID, updater BlockMetadataUpdater) error {
	bid := blockID.Bytes()

	s.lock.Lock()
	defer s.lock.Unlock()

	select {
	case <-s.shutdownCh:
		return ErrBlockMetadataStoreShutdown{}
	default:
	}

	var value BlockMetadataValue
	encoded, err := s.db.Get(bid, nil)
	switch errors.Cause(err) {
	case ldberrors.ErrNotFound:
	case nil:
		if err = s.config.Codec().Decode(encoded, &value); err != nil {
			s.log.CWarningf(ctx, "decoding block metadata error: %v", err)
		}
	default:
		s.log.CWarningf(ctx, "GetMetadata error: %v", err)
	}

	if err = updater(&value); err != nil {
		return err
	}

	if encoded, err = s.config.Codec().Encode(value); err != nil {
		return err
	}
	return s.db.PutWithMeter(bid, encoded, s.putMeter)
}

// xattrStore is a wrapper around BlockMetadataStore that handles xattr
// values.
type xattrStore struct {
	store BlockMetadataStore

	// Track the hit rate and eviction rate. These are goroutine safe.
	hitMeter  *CountMeter
	missMeter *CountMeter
	putMeter  *CountMeter
}

// NewXattrStoreFromBlockMetadataStore returns a XattrStore which is a wrapper
// around the passed in store.
func NewXattrStoreFromBlockMetadataStore(store BlockMetadataStore) XattrStore {
	return xattrStore{
		store:     store,
		hitMeter:  NewCountMeter(),
		missMeter: NewCountMeter(),
		putMeter:  NewCountMeter(),
	}
}

var _ XattrStore = (*xattrStore)(nil)

// GetXattr implements the XattrStore interface.
func (s xattrStore) GetXattr(ctx context.Context,
	blockID kbfsblock.ID, xattrType XattrType) ([]byte, error) {
	blockMetadata, err := s.store.GetMetadata(ctx, blockID)
	switch errors.Cause(err) {
	case ldberrors.ErrNotFound:
		s.missMeter.Mark(1)
		return nil, err
	case nil:
	default:
		return nil, err
	}

	v, ok := blockMetadata.Xattr[xattrType]
	if !ok {
		s.missMeter.Mark(1)
		return nil, ldberrors.ErrNotFound
	}

	s.hitMeter.Mark(1)
	return v, nil
}

// SetXattr implements the XattrStore interface.
func (s xattrStore) SetXattr(ctx context.Context,
	blockID kbfsblock.ID, xattrType XattrType, xattrValue []byte) (err error) {
	if err = s.store.UpdateMetadata(ctx, blockID,
		func(v *BlockMetadataValue) error {
			if v.Xattr == nil {
				v.Xattr = make(map[XattrType][]byte)
			}
			v.Xattr[xattrType] = xattrValue
			return nil
		}); err != nil {
		return err
	}

	s.putMeter.Mark(1)
	return nil
}

// NoopBlockMetadataStore satisfies the BlockMetadataStore interface but
// does nothing.
type NoopBlockMetadataStore struct{}

var _ BlockMetadataStore = NoopBlockMetadataStore{}

// GetMetadata always returns ldberrors.ErrNotFound.
func (NoopBlockMetadataStore) GetMetadata(ctx context.Context,
	blockID kbfsblock.ID) (value BlockMetadataValue, err error) {
	return BlockMetadataValue{}, ldberrors.ErrNotFound
}

// UpdateMetadata returns nil error but does nothing.
func (NoopBlockMetadataStore) UpdateMetadata(ctx context.Context,
	blockID kbfsblock.ID, updater BlockMetadataUpdater) error {
	return nil
}

// Shutdown does nothing.
func (NoopBlockMetadataStore) Shutdown() {}

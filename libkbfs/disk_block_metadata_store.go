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

	lock       sync.Mutex
	db         *levelDb
	shutdownCh chan struct{}
}

// newDiskBlockMetadataStore creates a new disk BlockMetadata storage.
func newDiskBlockMetadataStore(
	config diskBlockMetadataStoreConfig) (DiskBlockMetadataStore, error) {
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
func (c *diskBlockMetadataStore) Shutdown() {
	c.log.Debug("Shutting down diskBlockMetadataStore")
	c.lock.Lock()
	defer c.lock.Unlock()
	// shutdownCh has to be checked under lock, otherwise we can race.
	select {
	case <-c.shutdownCh:
		c.log.Warning("Shutdown called more than once")
	default:
	}
	close(c.shutdownCh)
	if c.db == nil {
		return
	}
	c.db.Close()
	c.db = nil
	c.hitMeter.Shutdown()
	c.missMeter.Shutdown()
	c.putMeter.Shutdown()
}

// ErrDiskBlockMetadataStoreShutdown is returned when methods are called on
// diskBlockMetadataStore when it's already shutdown.
type ErrDiskBlockMetadataStoreShutdown struct{}

// Error implements the error interface.
func (ErrDiskBlockMetadataStoreShutdown) Error() string {
	return "disk block metadata store has shutdown"
}

// DiskBlockMetadataValue represents the value stored in the block metadata
// store.
type DiskBlockMetadataValue struct {
	// Xattr contains all xattrs stored in association with the block. This is
	// useful for stuff that's contingent to content of the block, such as
	// quarantine data.
	Xattr map[XattrType][]byte
}

func (c *diskBlockMetadataStore) getMetadata(ctx context.Context,
	blockID kbfsblock.ID) (value DiskBlockMetadataValue, err error) {
	c.lock.Lock()
	defer c.lock.Unlock()

	select {
	case <-c.shutdownCh:
		return DiskBlockMetadataValue{}, ErrDiskBlockMetadataStoreShutdown{}
	default:
	}

	encoded, err := c.db.GetWithMeter(blockID.Bytes(), c.hitMeter, c.missMeter)
	switch errors.Cause(err) {
	case ldberrors.ErrNotFound:
		return DiskBlockMetadataValue{}, ldberrors.ErrNotFound
	case nil:
		if err = c.config.Codec().Decode(encoded, &value); err != nil {
			c.log.CWarningf(ctx, "decoding block metadata error: %v", err)
			return DiskBlockMetadataValue{}, ldberrors.ErrNotFound
		}
		return value, nil
	default:
		c.log.CWarningf(ctx, "getMetadata error: %v", err)
		return DiskBlockMetadataValue{}, ldberrors.ErrNotFound
	}
}

type blockMetadataUpdater func(*DiskBlockMetadataValue) error

func (c *diskBlockMetadataStore) setMetadata(ctx context.Context,
	blockID kbfsblock.ID, updater blockMetadataUpdater) error {
	bid := blockID.Bytes()

	c.lock.Lock()
	defer c.lock.Unlock()

	select {
	case <-c.shutdownCh:
		return ErrDiskBlockMetadataStoreShutdown{}
	default:
	}

	var value DiskBlockMetadataValue
	encoded, err := c.db.Get(bid, nil)
	switch errors.Cause(err) {
	case ldberrors.ErrNotFound:
	case nil:
		if err = c.config.Codec().Decode(encoded, &value); err != nil {
			c.log.CWarningf(ctx, "decoding block metadata error: %v", err)
		}
	default:
		c.log.CWarningf(ctx, "getMetadata error: %v", err)
	}

	if err = updater(&value); err != nil {
		return err
	}

	if encoded, err = c.config.Codec().Encode(value); err != nil {
		return err
	}
	if err = c.db.PutWithMeter(bid, encoded, c.putMeter); err != nil {
		return err
	}

	return nil
}

// GetXattr looks for and returns the Xattr value of xattrType for blockID if
// it's found, and ldberrors.ErrNotFound if it's not found.
func (c *diskBlockMetadataStore) GetXattr(ctx context.Context,
	blockID kbfsblock.ID, xattrType XattrType) ([]byte, error) {
	blockMetadata, err := c.getMetadata(ctx, blockID)
	if err != nil {
		return nil, err
	}

	v, ok := blockMetadata.Xattr[xattrType]
	if !ok {
		c.missMeter.Mark(1)
		return nil, ldberrors.ErrNotFound
	}

	return v, nil
}

// SetXattr sets xattrType Xattr to xattrValue for blockID.
func (c *diskBlockMetadataStore) SetXattr(ctx context.Context,
	blockID kbfsblock.ID, xattrType XattrType, xattrValue []byte) (err error) {
	return c.setMetadata(ctx, blockID, func(v *DiskBlockMetadataValue) error {
		if v.Xattr == nil {
			v.Xattr = make(map[XattrType][]byte)
		}
		v.Xattr[xattrType] = xattrValue
		return nil
	})
}

// NoopBlockMetadataStore satisfies the DiskBlockMetadataStore interface but
// does nothing.
type NoopBlockMetadataStore struct{}

// GetXattr always returns ldberrors.ErrNotFound.
func (NoopBlockMetadataStore) GetXattr(ctx context.Context,
	blockID kbfsblock.ID, xattrType XattrType) ([]byte, error) {
	return nil, ldberrors.ErrNotFound
}

// SetXattr returns nil error but does nothing.
func (NoopBlockMetadataStore) SetXattr(ctx context.Context,
	blockID kbfsblock.ID, xattrType XattrType, xattrValue []byte) error {
	return nil
}

// Shutdown does nothing.
func (NoopBlockMetadataStore) Shutdown() {}

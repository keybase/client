// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libquarantine

import (
	"context"
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/pkg/errors"
	ldberrors "github.com/syndtr/goleveldb/leveldb/errors"
)

// XattrType represents the Xattr type.
type XattrType int

// New types can only be added at end.
const (
	_ XattrType = iota
	XattrAppleQuarantine
)

// XattrStorage defines a type that stores xattrs.
type XattrStorage interface {
	Get(ctx context.Context,
		blockID kbfsblock.ID, xattrType XattrType) ([]byte, error)
	Set(ctx context.Context,
		blockID kbfsblock.ID, xattrType XattrType, xattrValue []byte) error
	Shutdown()
}

// NoopXattrStorage satisfies the XattrStorage interface but does nothing.
type NoopXattrStorage struct{}

// Get always returns ldberrors.ErrNotFound.
func (NoopXattrStorage) Get(ctx context.Context,
	blockID kbfsblock.ID, xattrType XattrType) ([]byte, error) {
	return nil, ldberrors.ErrNotFound
}

// Set returns nil error but does nothing.
func (NoopXattrStorage) Set(ctx context.Context,
	blockID kbfsblock.ID, xattrType XattrType, xattrValue []byte) error {
	return nil
}

// Shutdown does nothing.
func (NoopXattrStorage) Shutdown() {}

// NewNoopXattrStorage creates a XattrStorage that does nothing.
func NewNoopXattrStorage(diskXattrStorageConfig) (XattrStorage, error) {
	return NoopXattrStorage{}, nil
}

const (
	initialXattrStorageVersion uint64 = 1
	currentXattrStorageVersion uint64 = initialXattrStorageVersion
	xattrFolderName            string = "kbfs_xattr"
	xattrDbFilename            string = "diskXattr.leveldb"
)

type diskXattrStorageConfig interface {
	Codec() kbfscodec.Codec
	MakeLogger(module string) logger.Logger
	StorageRoot() string
}

// DiskXattrStorage interacts with Xattr data storage on disk.
type DiskXattrStorage struct {
	log   logger.Logger
	codec kbfscodec.Codec

	// Track the hit rate and eviction rate
	hitMeter  *libkbfs.CountMeter
	missMeter *libkbfs.CountMeter
	putMeter  *libkbfs.CountMeter

	lock       sync.Mutex
	db         libkbfs.LevelDB
	shutdownCh chan struct{}
}

// NewDiskXattrStorage creates a new disk Xattr storage.
func NewDiskXattrStorage(
	config diskXattrStorageConfig) (XattrStorage, error) {
	log := config.MakeLogger("DXC")
	db, err := libkbfs.OpenLevelDB(log, config.StorageRoot(),
		xattrFolderName, currentXattrStorageVersion, xattrDbFilename)
	if err != nil {
		return nil, err
	}
	return &DiskXattrStorage{
		log:        log,
		codec:      config.Codec(),
		hitMeter:   libkbfs.NewCountMeter(),
		missMeter:  libkbfs.NewCountMeter(),
		putMeter:   libkbfs.NewCountMeter(),
		db:         db,
		shutdownCh: make(chan struct{}),
	}, err
}

// DiskXattr holds Xattr values for each XattrType.
type DiskXattr map[XattrType][]byte

// Shutdown shuts done this storae.
func (c *DiskXattrStorage) Shutdown() {
	c.log.Debug("Shutting down DiskXattrStorage")
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

// ErrDiskXattrStorageShutdown is returned when methods are called on
// DiskXattrStorage when it's already shutdown.
type ErrDiskXattrStorageShutdown struct{}

// Error implements the error interface.
func (ErrDiskXattrStorageShutdown) Error() string {
	return "disk xattr storage has shutdown"
}

// Get looks for and returns the Xattr value of xattrType for blockID if it's
// found, and ldberrors.ErrNotFound if it's not found.
func (c *DiskXattrStorage) Get(ctx context.Context, blockID kbfsblock.ID,
	xattrType XattrType) ([]byte, error) {
	c.lock.Lock()
	defer c.lock.Unlock()

	select {
	case <-c.shutdownCh:
		return nil, ErrDiskXattrStorageShutdown{}
	default:
	}

	var xattr DiskXattr

	value, err := c.db.GetWithMeter(blockID.Bytes(), c.hitMeter, c.missMeter)
	switch errors.Cause(err) {
	case ldberrors.ErrNotFound:
		return nil, ldberrors.ErrNotFound
	case nil:
		if err = c.codec.Decode(value, &xattr); err != nil {
			c.log.CWarningf(ctx, "decoding xattr error: %v", err)
			return nil, ldberrors.ErrNotFound
		}
	default:
		c.log.CWarningf(ctx, "GetWithMeter error: %v", err)
		return nil, ldberrors.ErrNotFound
	}

	v, ok := xattr[xattrType]
	if !ok {
		c.missMeter.Mark(1)
		return nil, ldberrors.ErrNotFound
	}

	return v, nil
}

// Set sets xattrType Xattr to xattrValue for blockID.
func (c *DiskXattrStorage) Set(ctx context.Context, blockID kbfsblock.ID,
	xattrType XattrType, xattrValue []byte) error {
	c.lock.Lock()
	defer c.lock.Unlock()

	select {
	case <-c.shutdownCh:
		return ErrDiskXattrStorageShutdown{}
	default:
	}

	var xattr DiskXattr

	value, err := c.db.GetWithMeter(blockID.Bytes(), c.hitMeter, c.missMeter)
	switch errors.Cause(err) {
	case ldberrors.ErrNotFound:
		xattr = make(DiskXattr)
	case nil:
		if err = c.codec.Decode(value, &xattr); err != nil {
			c.log.CWarningf(ctx, "decoding xattr error: %v", err)
		}
	default:
		c.log.CWarningf(ctx, "GetWithMeter error: %v", err)
	}

	xattr[xattrType] = xattrValue

	encoded, err := c.codec.Encode(xattr)
	if err != nil {
		return err
	}

	err = c.db.PutWithMeter(blockID.Bytes(), encoded, c.putMeter)
	if err != nil {
		return err
	}

	return nil
}

// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io"

	"github.com/syndtr/goleveldb/leveldb"
	ldberrors "github.com/syndtr/goleveldb/leveldb/errors"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/storage"
)

var leveldbOptions = &opt.Options{
	Compression: opt.NoCompression,
	BlockSize:   1 << 16,
	// Default max open file descriptors (ulimit -n) is 256 on OS
	// X, and >=1024 on (most?) Linux machines. So set to a low
	// number since we have multiple leveldb instances.
	OpenFilesCacheCapacity: 10,
}

type levelDb struct {
	*leveldb.DB
	closer io.Closer
}

func (ldb *levelDb) Close() (err error) {
	err = ldb.DB.Close()
	// Hide the closer error
	_ = ldb.closer.Close()
	return err
}

// openLevelDB opens or recovers a leveldb.DB with a passed-in storage.Storage
// as its underlying storage layer.
func openLevelDB(stor storage.Storage) (*levelDb, error) {
	db, err := leveldb.Open(stor, leveldbOptions)
	if ldberrors.IsCorrupted(err) {
		// There's a possibility that if the leveldb wasn't closed properly
		// last time while it was being written, then the manifest is corrupt.
		// This means leveldb must rebuild its manifest, which takes longer
		// than a simple `Open`.
		// TODO: log here
		db, err = leveldb.Recover(stor, leveldbOptions)
	}
	if err != nil {
		stor.Close()
		return nil, err
	}
	return &levelDb{db, stor}, nil
}

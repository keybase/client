// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"github.com/blevesearch/bleve/index/store"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/syndtr/goleveldb/leveldb"
	billy "gopkg.in/src-d/go-billy.v4"
)

type bleveLevelDBStore struct {
	db *leveldb.DB
}

var _ store.KVStore = (*bleveLevelDBStore)(nil)

func newBleveLevelDBStore(bfs billy.Filesystem, readOnly bool) (
	*bleveLevelDBStore, error) {
	s, err := libfs.OpenLevelDBStorage(bfs, readOnly)
	if err != nil {
		return nil, err
	}
	db, err := leveldb.Open(s, nil)
	if err != nil {
		return nil, err
	}
	return &bleveLevelDBStore{db: db}, nil
}

// Writer implements the store.KVStore interface for bleveLevelDBStore.
func (bldbs *bleveLevelDBStore) Writer() (store.KVWriter, error) {
	return nil, nil
}

// Writer implements the store.KVStore interface for bleveLevelDBStore.
func (bldbs *bleveLevelDBStore) Reader() (store.KVReader, error) {
	return nil, nil
}

// close implements the store.KVStore interface for bleveLevelDBStore.
func (bldbs *bleveLevelDBStore) Close() error {
	return nil
}

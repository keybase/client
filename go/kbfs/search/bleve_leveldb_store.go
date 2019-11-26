// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"github.com/blevesearch/bleve/index/store"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/iterator"
	"github.com/syndtr/goleveldb/leveldb/util"
	billy "gopkg.in/src-d/go-billy.v4"
)

type bleveLevelDBIterator struct {
	iter iterator.Iterator
}

var _ store.KVIterator = (*bleveLevelDBIterator)(nil)

// Seek implements the store.KVIterator interface for bleveLevelDBIterator.
func (bldbi *bleveLevelDBIterator) Seek(key []byte) {
	_ = bldbi.iter.Seek(key)
}

// Next implements the store.KVIterator interface for bleveLevelDBIterator.
func (bldbi *bleveLevelDBIterator) Next() {
	_ = bldbi.iter.Next()
}

// Key implements the store.KVIterator interface for bleveLevelDBIterator.
func (bldbi *bleveLevelDBIterator) Key() []byte {
	return bldbi.iter.Key()
}

// Value implements the store.KVIterator interface for bleveLevelDBIterator.
func (bldbi *bleveLevelDBIterator) Value() []byte {
	return bldbi.iter.Value()
}

// Valid implements the store.KVIterator interface for bleveLevelDBIterator.
func (bldbi *bleveLevelDBIterator) Valid() bool {
	return bldbi.iter.Valid()
}

// Current implements the store.KVIterator interface for bleveLevelDBIterator.
func (bldbi *bleveLevelDBIterator) Current() ([]byte, []byte, bool) {
	return bldbi.Key(), bldbi.Value(), bldbi.Valid()
}

// Close implements the store.KVIterator interface for bleveLevelDBIterator.
func (bldbi *bleveLevelDBIterator) Close() error {
	bldbi.iter.Release()
	return nil
}

type bleveLevelDBReader struct {
	snap *leveldb.Snapshot
}

var _ store.KVReader = (*bleveLevelDBReader)(nil)

// Get implements the store.KVReader interface for bleveLevelDBReader.
func (bldbr *bleveLevelDBReader) Get(key []byte) ([]byte, error) {
	return bldbr.snap.Get(key, nil)
}

// MultiGet implements the store.KVReader interface for bleveLevelDBReader.
func (bldbr *bleveLevelDBReader) MultiGet(keys [][]byte) (
	values [][]byte, err error) {
	// leveldb doesn't have a simple multi-get interface, so just do
	// multiple fetches.  Snapshot is consistent so this is fine (if
	// inefficient).
	values = make([][]byte, len(keys))
	for i, k := range keys {
		v, err := bldbr.Get(k)
		if err != nil {
			return nil, err
		}
		values[i] = v
	}
	return values, nil
}

// PrefixIterator implements the store.KVReader interface for bleveLevelDBReader.
func (bldbr *bleveLevelDBReader) PrefixIterator(prefix []byte) store.KVIterator {
	r := util.BytesPrefix(prefix)
	return &bleveLevelDBIterator{
		iter: bldbr.snap.NewIterator(r, nil),
	}
}

// RangeIterator implements the store.KVReader interface for bleveLevelDBReader.
func (bldbr *bleveLevelDBReader) RangeIterator(
	start, end []byte) store.KVIterator {
	return &bleveLevelDBIterator{
		iter: bldbr.snap.NewIterator(&util.Range{
			Start: start,
			Limit: end,
		}, nil),
	}
}

// Close implements the store.KVReader interface for bleveLevelDBReader.
func (bldbr *bleveLevelDBReader) Close() error {
	bldbr.snap.Release()
	return nil
}

type bleveLevelDBWriter struct {
	db *leveldb.DB
}

var _ store.KVWriter = (*bleveLevelDBWriter)(nil)

// NewBatch implements the store.KVReader interface for bleveLevelDBWriter.
func (bldbw *bleveLevelDBWriter) NewBatch() store.KVBatch {
	return nil
}

// NewBatchEx implements the store.KVReader interface for bleveLevelDBWriter.
func (bldbw *bleveLevelDBWriter) NewBatchEx(store.KVBatchOptions) (
	[]byte, store.KVBatch, error) {
	return nil, nil, nil
}

// ExecuteBatch implements the store.KVReader interface for bleveLevelDBWriter.
func (bldbw *bleveLevelDBWriter) ExecuteBatch(batch store.KVBatch) error {
	return nil
}

// Close implements the store.KVReader interface for bleveLevelDBWriter.
func (bldbw *bleveLevelDBWriter) Close() error {
	return nil
}

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
	snap, err := bldbs.db.GetSnapshot()
	if err != nil {
		return nil, err
	}
	return &bleveLevelDBReader{snap: snap}, nil
}

// close implements the store.KVStore interface for bleveLevelDBStore.
func (bldbs *bleveLevelDBStore) Close() error {
	return nil
}

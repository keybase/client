// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"github.com/blevesearch/bleve/index/store"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/pkg/errors"
	"github.com/syndtr/goleveldb/leveldb"
	ldberrors "github.com/syndtr/goleveldb/leveldb/errors"
	"github.com/syndtr/goleveldb/leveldb/iterator"
	"github.com/syndtr/goleveldb/leveldb/storage"
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
	v, err := bldbr.snap.Get(key, nil)
	if err == ldberrors.ErrNotFound {
		return nil, nil
	}
	return v, err
}

// MultiGet implements the store.KVReader interface for bleveLevelDBReader.
func (bldbr *bleveLevelDBReader) MultiGet(keys [][]byte) (
	values [][]byte, err error) {
	return store.MultiGet(bldbr, keys)
}

// PrefixIterator implements the store.KVReader interface for bleveLevelDBReader.
func (bldbr *bleveLevelDBReader) PrefixIterator(prefix []byte) store.KVIterator {
	r := util.BytesPrefix(prefix)
	i := &bleveLevelDBIterator{
		iter: bldbr.snap.NewIterator(r, nil),
	}
	i.Next()
	return i
}

// RangeIterator implements the store.KVReader interface for bleveLevelDBReader.
func (bldbr *bleveLevelDBReader) RangeIterator(
	start, end []byte) store.KVIterator {
	i := &bleveLevelDBIterator{
		iter: bldbr.snap.NewIterator(&util.Range{
			Start: start,
			Limit: end,
		}, nil),
	}
	i.Next()
	return i
}

// Close implements the store.KVReader interface for bleveLevelDBReader.
func (bldbr *bleveLevelDBReader) Close() error {
	bldbr.snap.Release()
	return nil
}

type bleveLevelDBBatch struct {
	b *leveldb.Batch
	m *store.EmulatedMerge
}

func newbleveLevelDBBatch(
	totalBytes int, mo store.MergeOperator) *bleveLevelDBBatch {
	return &bleveLevelDBBatch{
		b: leveldb.MakeBatch(totalBytes),
		m: store.NewEmulatedMerge(mo),
	}
}

var _ store.KVBatch = (*bleveLevelDBBatch)(nil)

func (bldbb *bleveLevelDBBatch) Set(key, val []byte) {
	bldbb.b.Put(key, val)
}

func (bldbb *bleveLevelDBBatch) Delete(key []byte) {
	bldbb.b.Delete(key)
}

func (bldbb *bleveLevelDBBatch) Merge(key, val []byte) {
	// Adapted from github.com/blevesearch/bleve/index/store/batch.go.
	ck := make([]byte, len(key))
	copy(ck, key)
	cv := make([]byte, len(val))
	copy(cv, val)
	bldbb.m.Merge(key, val)
}

func (bldbb *bleveLevelDBBatch) Reset() {
	bldbb.b.Reset()
}

func (bldbb *bleveLevelDBBatch) Close() error {
	return nil
}

type bleveLevelDBWriter struct {
	db *leveldb.DB
	mo store.MergeOperator
}

var _ store.KVWriter = (*bleveLevelDBWriter)(nil)

// NewBatch implements the store.KVReader interface for bleveLevelDBWriter.
func (bldbw *bleveLevelDBWriter) NewBatch() store.KVBatch {
	return newbleveLevelDBBatch(0, bldbw.mo)
}

// NewBatchEx implements the store.KVReader interface for bleveLevelDBWriter.
func (bldbw *bleveLevelDBWriter) NewBatchEx(opts store.KVBatchOptions) (
	[]byte, store.KVBatch, error) {
	return make([]byte, opts.TotalBytes),
		newbleveLevelDBBatch(opts.TotalBytes, bldbw.mo), nil
}

// ExecuteBatch implements the store.KVReader interface for bleveLevelDBWriter.
func (bldbw *bleveLevelDBWriter) ExecuteBatch(batch store.KVBatch) error {
	b, ok := batch.(*bleveLevelDBBatch)
	if !ok {
		return errors.Errorf("Unexpected batch type: %T", batch)
	}

	// Adapted from github.com/blevesearch/bleve/index/store/boltdb/writer.go.
	for k, mergeOps := range b.m.Merges {
		kb := []byte(k)
		existingVal, err := bldbw.db.Get(kb, nil)
		if err == ldberrors.ErrNotFound {
			existingVal = nil
		} else if err != nil {
			return err
		}

		mergedVal, fullMergeOk := bldbw.mo.FullMerge(kb, existingVal, mergeOps)
		if !fullMergeOk {
			return errors.Errorf("merge operator returned failure")
		}
		b.Set(kb, mergedVal)
	}

	return bldbw.db.Write(b.b, nil)
}

// Close implements the store.KVReader interface for bleveLevelDBWriter.
func (bldbw *bleveLevelDBWriter) Close() error {
	// Does this need to close outstanding batches allocated by this writer?
	return nil
}

type bleveLevelDBStore struct {
	s  storage.Storage
	db *leveldb.DB
	mo store.MergeOperator
}

var _ store.KVStore = (*bleveLevelDBStore)(nil)

func newBleveLevelDBStore(
	bfs billy.Filesystem, readOnly bool, mo store.MergeOperator) (
	*bleveLevelDBStore, error) {
	s, err := libfs.OpenLevelDBStorage(bfs, readOnly)
	if err != nil {
		return nil, err
	}
	db, err := leveldb.Open(s, nil)
	if err != nil {
		return nil, err
	}
	return &bleveLevelDBStore{s: s, db: db, mo: mo}, nil
}

// Writer implements the store.KVStore interface for bleveLevelDBStore.
func (bldbs *bleveLevelDBStore) Writer() (store.KVWriter, error) {
	return &bleveLevelDBWriter{db: bldbs.db, mo: bldbs.mo}, nil
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
	err := bldbs.db.Close()
	if err != nil {
		return err
	}
	return bldbs.s.Close()
}

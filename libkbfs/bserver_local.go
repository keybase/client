package libkbfs

import (
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/opt"
)

// BlockServerLocal just stores blocks in a local leveldb instance
type BlockServerLocal struct {
	db *leveldb.DB
}

func NewBlockServerLocal(dbfile string) *BlockServerLocal {
	db, err := leveldb.OpenFile(
		dbfile,
		&opt.Options{
			Compression: opt.NoCompression,
		})
	if err != nil {
		return nil
	}
	return &BlockServerLocal{db}
}

func (b *BlockServerLocal) Get(
	id BlockId, context BlockContext) ([]byte, error) {
	return b.db.Get(id[:], nil)
}

func (b *BlockServerLocal) Put(
	id BlockId, context BlockContext, buf []byte) error {
	return b.db.Put(id[:], buf, nil)
}

func (b *BlockServerLocal) Delete(id BlockId, context BlockContext) error {
	return b.db.Delete(id[:], nil)
}

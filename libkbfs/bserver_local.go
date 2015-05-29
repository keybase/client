package libkbfs

import (
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/opt"
)

// BlockServerLocal implements the BlockServer interface by just
// storing blocks in a local leveldb instance
type BlockServerLocal struct {
	db *leveldb.DB
}

// NewBlockServerLocal constructs a new BlockServerLocal that stores
// its data in the given leveldb directory.
func NewBlockServerLocal(dbfile string) (*BlockServerLocal, error) {
	db, err := leveldb.OpenFile(
		dbfile,
		&opt.Options{
			Compression: opt.NoCompression,
		})
	if err != nil {
		return nil, err
	}
	bserv := &BlockServerLocal{db}
	return bserv, nil
}

// Get implements the BlockServer interface for BlockServerLocal
func (b *BlockServerLocal) Get(
	id BlockID, context BlockContext) ([]byte, error) {
	return b.db.Get(id[:], nil)
}

// Put implements the BlockServer interface for BlockServerLocal
func (b *BlockServerLocal) Put(
	id BlockID, context BlockContext, buf []byte) error {
	return b.db.Put(id[:], buf, nil)
}

// Delete implements the BlockServer interface for BlockServerLocal
func (b *BlockServerLocal) Delete(id BlockID, context BlockContext) error {
	return b.db.Delete(id[:], nil)
}

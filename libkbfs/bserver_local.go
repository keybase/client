package libkbfs

import (
	"encoding/hex"

	"github.com/keybase/client/go/libkb"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"golang.org/x/net/context"
)

type blockEntry struct {
	// These fields are only exported for serialization purposes.
	BlockData     []byte
	KeyServerHalf BlockCryptKeyServerHalf
}

// BlockServerLocal implements the BlockServer interface by just
// storing blocks in a local leveldb instance
type BlockServerLocal struct {
	config Config
	db     *leveldb.DB
}

var _ BlockServer = (*BlockServerLocal)(nil)

func newBlockServerLocalWithStorage(config Config, storage storage.Storage) (
	*BlockServerLocal, error) {
	db, err := leveldb.Open(storage, leveldbOptions)
	if err != nil {
		return nil, err
	}
	bserv := &BlockServerLocal{config, db}
	return bserv, nil
}

// NewBlockServerLocal constructs a new BlockServerLocal that stores
// its data in the given leveldb directory.
func NewBlockServerLocal(config Config, dbfile string) (
	*BlockServerLocal, error) {
	storage, err := storage.OpenFile(dbfile)
	if err != nil {
		return nil, err
	}
	return newBlockServerLocalWithStorage(config, storage)
}

// NewBlockServerMemory constructs a new BlockServerLocal that stores
// its data with an in-memory leveldb instance.
func NewBlockServerMemory(config Config) (*BlockServerLocal, error) {
	return newBlockServerLocalWithStorage(config, storage.NewMemStorage())
}

// Get implements the BlockServer interface for BlockServerLocal
func (b *BlockServerLocal) Get(ctx context.Context, id BlockID,
	context BlockContext) ([]byte, BlockCryptKeyServerHalf, error) {
	libkb.G.Log.Debug("BlockServerLocal::Get id=%s uid=%s\n", hex.EncodeToString(id[:]), context.GetWriter().String())
	buf, err := b.db.Get(id[:], nil)
	if err != nil {
		libkb.G.Log.Debug("BlockServerLocal::Get id=%s err=%v\n", hex.EncodeToString(id[:]), err)
		return nil, BlockCryptKeyServerHalf{}, err
	}
	var entry blockEntry
	err = b.config.Codec().Decode(buf, &entry)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}
	return entry.BlockData, entry.KeyServerHalf, nil
}

// Put implements the BlockServer interface for BlockServerLocal
func (b *BlockServerLocal) Put(ctx context.Context, id BlockID, tlfID TlfID,
	context BlockContext, buf []byte,
	serverHalf BlockCryptKeyServerHalf) error {
	libkb.G.Log.Debug("BlockServerLocal::Put id=%s uid=%s\n", hex.EncodeToString(id[:]), context.GetWriter().String())
	entry := blockEntry{BlockData: buf, KeyServerHalf: serverHalf}
	entryBuf, err := b.config.Codec().Encode(entry)
	if err != nil {
		libkb.G.Log.Warning("BlockServerLocal::Put id=%s err=%v\n", hex.EncodeToString(id[:]), err)
		return err
	}
	return b.db.Put(id[:], entryBuf, nil)
}

// Delete implements the BlockServer interface for BlockServerLocal
func (b *BlockServerLocal) Delete(ctx context.Context, id BlockID, tlfID TlfID,
	context BlockContext) error {
	libkb.G.Log.Debug("BlockServerLocal::Delete id=%s uid=%s\n", hex.EncodeToString(id[:]), context.GetWriter().String())
	return b.db.Delete(id[:], nil)
}

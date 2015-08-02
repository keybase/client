package libkbfs

import (
	"encoding/hex"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"golang.org/x/net/context"
)

type blockEntry struct {
	// These fields are only exported for serialization purposes.
	BlockData     []byte
	Refs          map[BlockRefNonce]bool
	KeyServerHalf BlockCryptKeyServerHalf
}

// BlockServerLocal implements the BlockServer interface by just
// storing blocks in a local leveldb instance
type BlockServerLocal struct {
	config Config
	lock   sync.Mutex
	db     *leveldb.DB
}

var _ BlockServer = (*BlockServerLocal)(nil)

func newBlockServerLocalWithStorage(config Config, storage storage.Storage) (
	*BlockServerLocal, error) {
	db, err := leveldb.Open(storage, leveldbOptions)
	if err != nil {
		return nil, err
	}
	bserv := &BlockServerLocal{config: config, db: db}
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

func (b *BlockServerLocal) getBlockEntryLocked(id BlockID) (
	*blockEntry, error) {
	buf, err := b.db.Get(id[:], nil)
	if err != nil {
		libkb.G.Log.Debug("BlockServerLocal.getBlockEntryLocked id=%s "+
			"err=%v\n", hex.EncodeToString(id[:]), err)
		return nil, err
	}
	var entry blockEntry
	err = b.config.Codec().Decode(buf, &entry)
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

// Get implements the BlockServer interface for BlockServerLocal
func (b *BlockServerLocal) Get(ctx context.Context, id BlockID,
	context BlockContext) ([]byte, BlockCryptKeyServerHalf, error) {
	b.lock.Lock()
	defer b.lock.Unlock()

	libkb.G.Log.Debug("BlockServerLocal.Get id=%s uid=%s\n",
		hex.EncodeToString(id[:]), context.GetWriter().String())
	entry, err := b.getBlockEntryLocked(id)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}
	return entry.BlockData, entry.KeyServerHalf, nil
}

func (b *BlockServerLocal) putBlockEntryLocked(
	id BlockID, entry *blockEntry) error {
	entryBuf, err := b.config.Codec().Encode(entry)
	if err != nil {
		libkb.G.Log.Warning("BlockServerLocal.putBlockEntry id=%s err=%v\n",
			hex.EncodeToString(id[:]), err)
		return err
	}
	return b.db.Put(id[:], entryBuf, nil)
}

// Put implements the BlockServer interface for BlockServerLocal
func (b *BlockServerLocal) Put(ctx context.Context, id BlockID, tlfID TlfID,
	context BlockContext, buf []byte,
	serverHalf BlockCryptKeyServerHalf) error {
	b.lock.Lock()
	defer b.lock.Unlock()

	libkb.G.Log.Debug("BlockServerLocal.Put id=%s uid=%s\n",
		hex.EncodeToString(id[:]), context.GetWriter().String())

	if context.GetRefNonce() != zeroBlockRefNonce {
		return fmt.Errorf("Can't Put() a block with a non-zero refnonce.")
	}

	entry := &blockEntry{
		BlockData:     buf,
		Refs:          make(map[BlockRefNonce]bool),
		KeyServerHalf: serverHalf,
	}
	entry.Refs[zeroBlockRefNonce] = true
	return b.putBlockEntryLocked(id, entry)
}

// AddBlockReference implements the BlockServer interface for BlockServerLocal
func (b *BlockServerLocal) AddBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
	b.lock.Lock()
	defer b.lock.Unlock()

	refNonce := context.GetRefNonce()
	libkb.G.Log.Debug("BlockServerLocal.AddBlockReference id=%s "+
		"refnonce=%s uid=%s\n", hex.EncodeToString(id[:]),
		hex.EncodeToString(refNonce[:]), context.GetWriter().String())

	entry, err := b.getBlockEntryLocked(id)
	if err != nil {
		if err == leveldb.ErrNotFound {
			return IncrementMissingBlockError{id}
		}
		return err
	}

	entry.Refs[refNonce] = true
	return b.putBlockEntryLocked(id, entry)
}

// RemoveBlockReference implements the BlockServer interface for
// BlockServerLocal
func (b *BlockServerLocal) RemoveBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
	b.lock.Lock()
	defer b.lock.Unlock()

	libkb.G.Log.Debug("BlockServerLocal.RemoveBlockReference id=%s uid=%s\n",
		hex.EncodeToString(id[:]), context.GetWriter().String())

	entry, err := b.getBlockEntryLocked(id)
	if err != nil {
		if err == leveldb.ErrNotFound {
			// this block is already gone; no error
			return nil
		}
		return err
	}

	delete(entry.Refs, context.GetRefNonce())
	if len(entry.Refs) == 0 {
		return b.db.Delete(id[:], nil)
	}
	return b.putBlockEntryLocked(id, entry)
}

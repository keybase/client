package libkbfs

import (
	"encoding/hex"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

// BlockServerLocal implements the BlockServer interface by just
// storing blocks in a local leveldb instance
type BlockServerLocal struct {
	config Config
	s      bserverLocalStorage
}

var _ BlockServer = (*BlockServerLocal)(nil)

// NewBlockServerLocal constructs a new BlockServerLocal that stores
// its data in the given leveldb directory.
func NewBlockServerLocal(config Config, dbfile string) (
	*BlockServerLocal, error) {
	s := makeBserverFileStorage(config.Codec(), dbfile)
	bserv := &BlockServerLocal{config: config, s: s}
	return bserv, nil
}

// NewBlockServerMemory constructs a new BlockServerLocal that stores
// its data in memory.
func NewBlockServerMemory(config Config) (*BlockServerLocal, error) {
	s := makeBserverMemStorage()
	return &BlockServerLocal{config: config, s: s}, nil
}

// Get implements the BlockServer interface for BlockServerLocal
func (b *BlockServerLocal) Get(ctx context.Context, id BlockID,
	context BlockContext) ([]byte, BlockCryptKeyServerHalf, error) {
	libkb.G.Log.Debug("BlockServerLocal.Get id=%s uid=%s\n",
		hex.EncodeToString(id[:]), context.GetWriter().String())
	entry, err := b.s.get(id)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}
	return entry.BlockData, entry.KeyServerHalf, nil
}

// Put implements the BlockServer interface for BlockServerLocal
func (b *BlockServerLocal) Put(ctx context.Context, id BlockID, tlfID TlfID,
	context BlockContext, buf []byte,
	serverHalf BlockCryptKeyServerHalf) error {
	libkb.G.Log.Debug("BlockServerLocal.Put id=%s uid=%s\n",
		hex.EncodeToString(id[:]), context.GetWriter().String())

	if context.GetRefNonce() != zeroBlockRefNonce {
		return fmt.Errorf("Can't Put() a block with a non-zero refnonce.")
	}

	entry := blockEntry{
		BlockData:     buf,
		Refs:          make(map[BlockRefNonce]bool),
		KeyServerHalf: serverHalf,
	}
	entry.Refs[zeroBlockRefNonce] = true
	return b.s.put(id, entry)
}

// AddBlockReference implements the BlockServer interface for BlockServerLocal
func (b *BlockServerLocal) AddBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
	refNonce := context.GetRefNonce()
	libkb.G.Log.Debug("BlockServerLocal.AddBlockReference id=%s "+
		"refnonce=%s uid=%s\n", hex.EncodeToString(id[:]),
		hex.EncodeToString(refNonce[:]), context.GetWriter().String())

	return b.s.addReference(id, refNonce)
}

// RemoveBlockReference implements the BlockServer interface for
// BlockServerLocal
func (b *BlockServerLocal) RemoveBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
	refNonce := context.GetRefNonce()
	libkb.G.Log.Debug("BlockServerLocal.RemoveBlockReference id=%s uid=%s\n",
		hex.EncodeToString(id[:]), context.GetWriter().String())

	return b.s.removeReference(id, refNonce)
}

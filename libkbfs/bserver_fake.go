package libkbfs

import (
	"fmt"
)

// FakeBlockServer implements the BlockServer interface by just
// storing blocks in an in-memory map.
type FakeBlockServer struct {
	blocks map[BlockID][]byte
}

// NewFakeBlockServer constructs a new FakeBlockServer instance.
func NewFakeBlockServer() *FakeBlockServer {
	blocks := make(map[BlockID][]byte)
	return &FakeBlockServer{blocks}
}

// Get implements the BlockServer interface for FakeBlockServer
func (b *FakeBlockServer) Get(
	id BlockID, context BlockContext) ([]byte, error) {
	buf, ok := b.blocks[id]
	if !ok {
		return nil, fmt.Errorf("Could not get block for %s", id)
	}
	return buf, nil
}

// Put implements the BlockServer interface for FakeBlockServer
func (b *FakeBlockServer) Put(
	id BlockID, context BlockContext, buf []byte) error {
	b.blocks[id] = buf
	return nil
}

// Delete implements the BlockServer interface for FakeBlockServer
func (b *FakeBlockServer) Delete(id BlockID, context BlockContext) error {
	delete(b.blocks, id)
	return nil
}

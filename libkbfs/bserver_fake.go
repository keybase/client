package libkbfs

import (
	"fmt"
)

// FakeBlockServer just stores blocks in a map.
type FakeBlockServer struct {
	blocks map[BlockId][]byte
}

func NewFakeBlockServer() *FakeBlockServer {
	blocks := make(map[BlockId][]byte)
	return &FakeBlockServer{blocks}
}

func (b *FakeBlockServer) Get(
	id BlockId, context BlockContext) ([]byte, error) {
	buf, ok := b.blocks[id]
	if !ok {
		return nil, fmt.Errorf("Could not get block for %s", id)
	}
	return buf, nil
}

func (b *FakeBlockServer) Put(
	id BlockId, context BlockContext, buf []byte) error {
	b.blocks[id] = buf
	return nil
}

func (b *FakeBlockServer) Delete(id BlockId, context BlockContext) error {
	delete(b.blocks, id)
	return nil
}

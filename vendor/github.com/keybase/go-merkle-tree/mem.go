package merkleTree

import (
	"crypto/sha512"
	"encoding/hex"

	"golang.org/x/net/context"
)

// MemEngine is an in-memory MerkleTree engine, used now mainly for testing
type MemEngine struct {
	root  Hash
	nodes map[string][]byte
}

// NewMemEngine makes an in-memory storage engine, mainly for testing.
func NewMemEngine() *MemEngine {
	return &MemEngine{
		nodes: make(map[string][]byte),
	}
}

var _ StorageEngine = (*MemEngine)(nil)

// CommitRoot "commits" the root ot the blessed memory slot
func (m *MemEngine) CommitRoot(_ context.Context, prev Hash, curr Hash, txinfo TxInfo) error {
	m.root = curr
	return nil
}

// Hash runs SHA512
func (m *MemEngine) Hash(_ context.Context, d []byte) Hash {
	sum := sha512.Sum512(d)
	return Hash(sum[:])
}

// LookupNode looks up a MerkleTree node by hash
func (m *MemEngine) LookupNode(_ context.Context, h Hash) (b []byte, err error) {
	return m.nodes[hex.EncodeToString(h)], nil
}

// LookupRoot fetches the root of the in-memory tree back out
func (m *MemEngine) LookupRoot(_ context.Context) (Hash, error) {
	return m.root, nil
}

// StoreNode stores the given node under the given key.
func (m *MemEngine) StoreNode(_ context.Context, key Hash, b []byte) error {
	m.nodes[hex.EncodeToString(key)] = b
	return nil
}

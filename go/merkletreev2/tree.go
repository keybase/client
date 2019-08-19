package merkletreev2

import "sync"

// Tree is the MerkleTree class; it needs an engine and a configuration
// to run
type Tree struct {
	sync.RWMutex
	//eng StorageEngine not yet implemented/defined
	cfg Config
}

// ValueConstructor is an interface for constructing values, so that typed
// values can be pulled out of the Merkle Tree. We are of course assuming
// that there is only one type of Value at the leaves, which makes sense.
type ValueConstructor interface {
	// Construct a new template empty value for the leaf, so that the
	// Unmarshalling routine has the correct type template.
	Construct() interface{}
}

// Hash is a byte-array, used to represent a full collision-resistant hash.
type Hash []byte

// Key is a byte-array, and it is the type of the keys in the KeyValuePairs that
// the tree can store.
type Key []byte

// SeqNo is an integer used to differentiate different versions of a merkle tree.
type SeqNo uint32

// ChildIndex specifies one of an iNode's child nodes.
type ChildIndex uint32

// NewTree makes a new tree
func NewTree(c Config) *Tree {
	return &Tree{cfg: c}
}

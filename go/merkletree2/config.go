package merkletree2

// Config defines the shape of the MerkleTree.
type Config struct {
	// A hasher is used to compute hashes in this configuration
	hasher Hasher

	// The number of children per node. Must be a power of two.
	childrenPerNode int

	// The maximum number of KeyValuePairs in a leaf node before we split
	valuesPerLeaf int

	// The number of bits necessary to represent a ChildIndex, i.e. log2(m)
	bitsPerIndex uint8

	// The length of all the keys which will be stored in the tree. For
	// simplicity, we enforce that all the keys have the same length and that
	// bitsPerIndex divides keyByteLength*8
	keysByteLength int

	// Construct a new object to unmarshal values into
	valueConstructor ValueConstructor
}

// NewConfig makes a new config object. It takes a a Hasher (for example
// sha512.Sum512), logChildrenPerNode which is the base 2 logarithm of the
// number of children per interior node, valuesPerLeaf the maximum number of
// entries in a leaf before the leaf is split into multiple nodes (at a lower
// level in the tree), keyByteLength the length of the Keys which the tree
// will store, and a valueConstructor (so that typed values can be pulled out
// of the Merkle Tree).
func NewConfig(h Hasher, logChildrenPerNode uint8, valuesPerLeaf int, keysByteLength int, valueConstructor ValueConstructor) (Config, error) {
	childrenPerNode := 1 << logChildrenPerNode
	if (keysByteLength*8)%childrenPerNode != 0 {
		return Config{}, NewInvalidConfigError("keyBitLength does not divide 2^logChildrenPerNode")
	}
	return Config{hasher: h, childrenPerNode: 1 << logChildrenPerNode, valuesPerLeaf: valuesPerLeaf, bitsPerIndex: logChildrenPerNode, keysByteLength: keysByteLength, valueConstructor: valueConstructor}, nil
}

// Hasher is an interface for hashing MerkleTree data structures into their
// cryptographic hashes.
type Hasher interface {
	Hash([]byte) Hash
}

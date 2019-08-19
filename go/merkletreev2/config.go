package merkletreev2

import "fmt"

// Config defines the shape of the MerkleTree.
type Config struct {
	// A hasher is used to compute hashes in this configuration
	hasher Hasher

	// The number of children per node. Must be a power of two.
	childrenPerNode uint

	// The maximum number of KeyValuePairs in a leaf node before we split
	valuesPerLeaf uint

	// The number of bits necessary to represent a ChildIndex, i.e. log2(m)
	bitsPerIndex uint8

	// Construct a new object to unmarshal values into
	valueConstructor ValueConstructor
}

// NewConfig makes a new config object. It takes a a Hasher (for example
// sha512.Sum512), childrenPerNode which is the number of children per interior
// node (must be a power of 2), valuesPerLeaf the maximum number of entries in a
// leaf before the leaf is split into multiple nodes (at a lower level in the
// tree), and a valueConstructor (so that typed values can be pulled out of the
// Merkle Tree).
func NewConfig(h Hasher, childrenPerNode uint, valuesPerLeaf uint, valueConstructor ValueConstructor) (Config, error) {
	if !isPowerOfTwo(childrenPerNode) {
		return Config{}, fmt.Errorf("childrenPerNode needs to be a power of two")
	}
	return Config{hasher: h, childrenPerNode: childrenPerNode, valuesPerLeaf: valuesPerLeaf, bitsPerIndex: log2(childrenPerNode), valueConstructor: valueConstructor}, nil
}

// Hasher is an interface for hashing MerkleTree data structures into their
// cryptographic hashes.
type Hasher interface {
	Hash([]byte) Hash
}

func log2(y uint) (n uint8) {
	n = 0
	for y > 1 {
		y = (y >> 1)
		n++
	}
	return n
}

func isPowerOfTwo(x uint) bool {
	return (x & (x - 1)) == 0
}

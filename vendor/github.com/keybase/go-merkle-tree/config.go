package merkleTree

import (
	"encoding/binary"
)

// Hasher is an interface for hashing MerkleTree data structures into their
// cryptographic hashes.
type Hasher interface {
	Hash([]byte) Hash
}

// ValueConstructor is an interface for constructing values, so that typed
// values can be pulled out of the Merkle Tree. We are of course assuming
// that there is only one type of Value at the leaves, which makes sense.
type ValueConstructor interface {
	// Construct a new template empty value for the leaf, so that the
	// Unmarshalling routine has the correct type template.
	Construct() interface{}
}

// Config defines the shape of the MerkleTree.
type Config struct {
	// A hasher is used to compute hashes in this configuration
	hasher Hasher

	// The number of children per node
	m ChildIndex

	// The maximum number of leaves before we split
	n ChildIndex

	// If we have M children per node, how many bits does it take to represent it?
	c ChildIndex

	// Construct a new object to unmarshal values into
	v ValueConstructor
}

func log2(y ChildIndex) ChildIndex {
	ret := ChildIndex(0)
	for y > 1 {
		y = (y >> 1)
		ret++
	}
	return ret
}

// NewConfig makes a new config object. Pass it a Hasher
// (though we suggest sha512.Sum512); a parameter `m` which
// is the number of children per interior node (we recommend 256),
// and `n`, the maximum number of entries in a leaf before a
// new level of the tree is introduced.
func NewConfig(h Hasher, m ChildIndex, n ChildIndex, v ValueConstructor) Config {
	return Config{hasher: h, m: m, n: n, c: log2(m), v: v}
}

func (c Config) prefixAndIndexAtLevel(level Level, h Hash) (Prefix, ChildIndex) {
	prfx, ci := bitslice(h, int(c.c), int(level))
	return Prefix(prfx), ChildIndex(ci)
}
func (c Config) prefixAtLevel(level Level, h Hash) Prefix {
	ret, _ := c.prefixAndIndexAtLevel(level, h)
	return ret
}

func div8roundUp(i ChildIndex) ChildIndex {
	return ((i + 7) >> 3)
}

func (c Config) formatPrefix(index ChildIndex) Prefix {
	ret := make([]byte, 4)
	binary.BigEndian.PutUint32(ret, uint32(index))
	return Prefix(ret[(4 - (7+c.c)/8):])
}

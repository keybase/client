package merkletree2

// TreeConfig defines the shape of the MerkleTree.
type TreeConfig struct {
	// A hasher is used to compute hashes in this configuration, and also
	// manages the blinding secrets (see useBlindedValueHashes).
	hasher Hasher

	// useBlindedValueHashes controls wether this tree blinds hashes of
	// KeyValuePairs with a per (Key,Seqno) specific secret (which is itself
	// derived from a per Seqno specific secret which is stored together with
	// the tree). This ensures values stored in the tree cannot are not leaked
	// by the membership proofs (but keys can leak, as well as the rough tree
	// size). If the tree is rebuilt at every Seqno, this also hides wether
	// values are changing (but not when a value is first inserted).
	useBlindedValueHashes bool

	// The number of children per node. Must be a power of two. Some children
	// can be empty.
	childrenPerNode int

	// The maximum number of KeyValuePairs in a leaf node before we split
	maxValuesPerLeaf int

	// The number of bits necessary to represent a ChildIndex, i.e.
	// log2(childrenPerNode)
	bitsPerIndex uint8

	// The length of all the keys which will be stored in the tree. For
	// simplicity, we enforce that all the keys have the same length and that
	// bitsPerIndex divides keyByteLength*8
	keysByteLength int
}

// NewConfig makes a new config object. It takes a a Hasher, logChildrenPerNode
// which is the base 2 logarithm of the number of children per interior node,
// valuesPerLeaf the maximum number of entries in a leaf before the leaf is
// split into multiple nodes (at a lower level in the tree), keyByteLength the
// length of the Keys which the tree will store, and a valueConstructor (so that
// typed values can be pulled out of the Merkle Tree).
func NewConfig(h Hasher, useBlindedValueHashes bool, logChildrenPerNode uint8, valuesPerLeaf int, keysByteLength int) (TreeConfig, error) {
	childrenPerNode := 1 << logChildrenPerNode
	if (keysByteLength*8)%int(logChildrenPerNode) != 0 {
		return TreeConfig{}, NewInvalidConfigError("The key bit length does not divide logChildrenPerNode")
	}
	if logChildrenPerNode > 63 {
		return TreeConfig{}, NewInvalidConfigError("This package does not support more than 2^63 children per internal node")
	}
	return TreeConfig{hasher: h, useBlindedValueHashes: useBlindedValueHashes, childrenPerNode: childrenPerNode, maxValuesPerLeaf: valuesPerLeaf, bitsPerIndex: logChildrenPerNode, keysByteLength: keysByteLength}, nil
}

type MasterSecret []byte
type KeySpecificSecret []byte

// Hasher is an interface for hashing MerkleTree data structures into their
// cryptographic hashes. It also manages blinding secrets.
type Hasher interface {
	EncodeAndHashGeneric(interface{}) (Hash, error)
	HashKeyValuePairWithMasterSecret(KeyValuePair, Seqno, MasterSecret) (Hash, error)
	HashKeyValuePairWithKeySpecificSecret(KeyValuePair, KeySpecificSecret) (Hash, error)
	GenerateMasterSecret(Seqno) (MasterSecret, error)
	ComputeKeySpecificSecret(MasterSecret, Seqno, Key) KeySpecificSecret
}

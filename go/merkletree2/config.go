package merkletree2

// ValueConstructor is an interface for constructing values, so that typed
// values can be pulled out of the Merkle Tree. All Values must have the same
// type, howerver multiple types can be encoded by having this type implement
// the codec.Selfer interface.
type ValueConstructor interface {
	// Construct a new template empty value for the leaf, so that the
	// Unmarshalling routine has the correct type template.
	Construct() interface{}
}

// Config defines the shape of the MerkleTree.
type Config struct {
	// An encoder is used to compute hashes in this configuration, and also
	// manages the blinding secrets (see useBlindedValueHashes).
	encoder Encoder

	// useBlindedValueHashes controls whether this tree blinds hashes of
	// KeyValuePairs with a per (Key,Seqno) specific secret (which is itself
	// derived from a per Seqno specific secret which is stored together with
	// the tree). This ensures values stored in the tree cannot are not leaked
	// by the membership proofs (but keys can leak, as well as the rough tree
	// size). If the tree is rebuilt at every Seqno, this also hides whether
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

	// valueConstructor is an interface to construct empty values to be used for
	// deserialization.
	valueConstructor ValueConstructor
}

// NewConfig makes a new config object. It takes a a Hasher, logChildrenPerNode
// which is the base 2 logarithm of the number of children per interior node,
// maxValuesPerLeaf the maximum number of entries in a leaf before the leaf is
// split into multiple nodes (at a lower level in the tree), keyByteLength the
// length of the Keys which the tree will store, and a valueConstructor (so that
// typed values can be pulled out of the Merkle Tree).
func NewConfig(h Encoder, useBlindedValueHashes bool, logChildrenPerNode uint8, maxValuesPerLeaf int, keysByteLength int) (Config, error) {
	childrenPerNode := 1 << logChildrenPerNode
	if (keysByteLength*8)%int(logChildrenPerNode) != 0 {
		return Config{}, NewInvalidConfigError("The key bit length does not divide logChildrenPerNode")
	}
	if logChildrenPerNode > 63 {
		return Config{}, NewInvalidConfigError("This package does not support more than 2^63 children per internal node")
	}
	return Config{encoder: h, useBlindedValueHashes: useBlindedValueHashes, childrenPerNode: childrenPerNode, maxValuesPerLeaf: maxValuesPerLeaf, bitsPerIndex: logChildrenPerNode, keysByteLength: keysByteLength, valueConstructor: nil}, nil
}

// MasterSecret is a secret used to hide wether a leaf value has changed between
// different versions (Seqnos) in a blinded merkle tree. One MasterSecret per
// tree is generated for each Seqno, and such secret is then used to generate a
// KeySpecific secret per leaf.
type MasterSecret []byte

// MasterSecret is a secret used to hide wether a leaf value has changed between
// different versions (Seqnos) in a blinded merkle tree. This is derived from a
// per-Seqno MasterSecret as specified by the Encoder
type KeySpecificSecret []byte

// Encoder is an interface for hashing MerkleTree data structures into their
// cryptographic hashes. It also manages blinding secrets.
type Encoder interface {
	EncodeAndHashGeneric(interface{}) (Hash, error)
	HashKeyValuePairWithMasterSecret(KeyValuePair, MasterSecret) (Hash, error)
	HashKeyValuePairWithKeySpecificSecret(KeyValuePair, KeySpecificSecret) (Hash, error)
	GenerateMasterSecret(Seqno) (MasterSecret, error)
	ComputeKeySpecificSecret(MasterSecret, Key) KeySpecificSecret
}

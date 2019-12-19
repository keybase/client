package merkletree2

import "fmt"

// Config defines the shape of the MerkleTree.
type Config struct {
	// An encoder is used to compute hashes in this configuration, and also
	// manages the blinding secrets (see UseBlindedValueHashes).
	Encoder Encoder

	// UseBlindedValueHashes controls whether this tree blinds hashes of
	// KeyValuePairs with a per (Key,Seqno) specific secret (which is itself
	// derived from a per Seqno specific secret which is stored together with
	// the tree). This ensures values stored in the tree cannot are not leaked
	// by the membership proofs (but keys can leak, as well as the rough tree
	// size). If the tree is rebuilt at every Seqno, this also hides whether
	// values are changing (but not when a value is first inserted).
	UseBlindedValueHashes bool

	// The number of children per node. Must be a power of two. Some children
	// can be empty.
	ChildrenPerNode int

	// The maximum number of KeyValuePairs in a leaf node before we split
	MaxValuesPerLeaf int

	// The number of bits necessary to represent a ChildIndex, i.e.
	// log2(childrenPerNode)
	BitsPerIndex uint8

	// The length of all the keys which will be stored in the tree. For
	// simplicity, we enforce that all the keys have the same length and that
	// bitsPerIndex divides keyByteLength*8
	KeysByteLength int

	// The maximum depth of the tree. Should always equal keysByteLength*8/bitsPerIndex
	MaxDepth int

	// ConstructValueContainer constructs a new empty value for the value in a KeyValuePair, so that the
	// decoding routine has the correct type template.
	ConstructValueContainer func() interface{}
}

// NewConfig makes a new config object. It takes a a Hasher, logChildrenPerNode
// which is the base 2 logarithm of the number of children per interior node,
// maxValuesPerLeaf the maximum number of entries in a leaf before the leaf is
// split into multiple nodes (at a lower level in the tree), keyByteLength the
// length of the Keys which the tree will store, and a ConstructValueContainer function (so that
// typed values can be pulled out of the Merkle Tree).
func NewConfig(e Encoder, useBlindedValueHashes bool, logChildrenPerNode uint8, maxValuesPerLeaf int, keysByteLength int, constructValueFunc func() interface{}) (Config, error) {
	childrenPerNode := 1 << logChildrenPerNode
	if (keysByteLength*8)%int(logChildrenPerNode) != 0 {
		return Config{}, NewInvalidConfigError("The key bit length does not divide logChildrenPerNode")
	}
	if logChildrenPerNode > 63 {
		return Config{}, NewInvalidConfigError("This package does not support more than 2^63 children per internal node")
	}
	if logChildrenPerNode < 1 {
		return Config{}, NewInvalidConfigError(fmt.Sprintf("Need at least 2 children per node, but logChildrenPerNode = %v", logChildrenPerNode))
	}
	maxDepth := keysByteLength * 8 / int(logChildrenPerNode)
	return Config{Encoder: e, UseBlindedValueHashes: useBlindedValueHashes, ChildrenPerNode: childrenPerNode, MaxValuesPerLeaf: maxValuesPerLeaf, BitsPerIndex: logChildrenPerNode, KeysByteLength: keysByteLength, MaxDepth: maxDepth, ConstructValueContainer: constructValueFunc}, nil
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

// Encoder is an interface for cryptographically hashing MerkleTree data
// structures. It also manages blinding secrets.
type Encoder interface {
	Decode(dest interface{}, src []byte) error
	Encode(src interface{}) (dst []byte, err error)
	// takes as input a []byte pointer dst to avoid creating new objects
	EncodeTo(o interface{}, dst *[]byte) (err error)

	EncodeAndHashGeneric(interface{}) (encoded []byte, hash Hash, err error)
	// takes as input an hash pointer ret to avoid creating new objects
	HashGeneric(o interface{}, ret *Hash) error

	GenerateMasterSecret(Seqno) (MasterSecret, error)
	ComputeKeySpecificSecret(MasterSecret, Key) KeySpecificSecret
	// takes as input a KeySpecificSecret pointer to avoid creating new objects
	ComputeKeySpecificSecretTo(MasterSecret, Key, *KeySpecificSecret)

	HashKeyValuePairWithKeySpecificSecret(KeyValuePair, KeySpecificSecret) (Hash, error)
	HashKeyEncodedValuePairWithKeySpecificSecret(KeyEncodedValuePair, KeySpecificSecret) (Hash, error)
	// takes as input an hash pointer ret to avoid creating new objects
	HashKeyEncodedValuePairWithKeySpecificSecretTo(KeyEncodedValuePair, KeySpecificSecret, *Hash) error

	GetEncodingType() EncodingType
}

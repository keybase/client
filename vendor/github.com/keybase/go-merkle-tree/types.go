package merkleTree

// Hash is a byte-array, used to represent a full collision-resistant hash.
type Hash []byte

// TxInfo is optional information that can be committed to a database along
// with a new MerkleTree root.
type TxInfo []byte

// Prefix is the prefix of a Hash, for lookup of interior nodes.
type Prefix []byte

// KeyValuePair is something inserted into the merkle tree. The key can
// be something like a UID or a TLF ID.  The Value is a generic interface,
// so you can store anything there, as long as it obeys Msgpack-decoding
// behavior.
//
// Note that though the key is of type `Hash`, it can be a smaller or different
// hash from the one used for interior nodes.
type KeyValuePair struct {
	_struct bool        `codec:",toarray"`
	Key     Hash        `codec:"k"`
	Value   interface{} `codec:"v"`
}

type nodeType int

const (
	nodeTypeNone  nodeType = 0
	nodeTypeINode nodeType = 1
	nodeTypeLeaf  nodeType = 2
)

// Node is a node in the merkle tree. Can be either an interior iNode or
// a leaf that has pointers to user data.
type Node struct {
	PrevRoot Hash           `codec:"p,omitempty"`
	INodes   []Hash         `codec:"i,omitempty"`
	Leafs    []KeyValuePair `codec:"l,omitempty"`
	Type     nodeType       `codec:"t"`
}

// Level specifies what level of the merkle tree we are at.
type Level uint

// ChildIndex specifies one of an iNode's child nodes.
type ChildIndex uint32

// Eq returns true if the two prefixes are equal
func (p Prefix) Eq(p2 Prefix) bool { return Hash(p).Eq(Hash(p2)) }

// ToHash converts a prefix into a hash, with a simple cast.
func (p Prefix) ToHash() Hash { return Hash(p) }

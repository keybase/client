package merkle

import (
	"crypto/sha512"

	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/sig3"
	merkletree "github.com/keybase/go-merkle-tree"
	"github.com/pkg/errors"
)

type TreeSeqno int64

type EncodingType byte

const (
	EncodingTypeBlindedSHA512_256v1 EncodingType = 1 // p = HMAC-SHA512-256; (k, v) -> (k, p(p(k, s), v)) where s is a secret unique per Merkle seqno
)

const CurrentEncodingType = EncodingTypeBlindedSHA512_256v1

func GetTreeConfig(encodingType EncodingType) (merkletree.Config, error) {
	if encodingType == EncodingTypeBlindedSHA512_256v1 {
		return merkletree.NewConfig(SHA512_256Hasher{}, 32, 64, EncodedLeaf{}), nil
	}
	return merkletree.Config{}, errors.Errorf("unknown encoding type %q", encodingType)
}

type EncodedLeaf []byte

var _ merkletree.ValueConstructor = (*EncodedLeaf)(nil)

func (l EncodedLeaf) Construct() interface{} {
	return &[]byte{}
}

type LeafType uint16

const (
	LeafTypeTeamv1 = 1
)

type LeafBytes []byte
type LeafContainer struct {
	_struct   bool      `codec:",toarray"` //nolint
	LeafType  LeafType  // specifies structure of leafBytes
	LeafBytes LeafBytes // msgpack deserialization implements Leaf
}

func NewLeafContainer(leafType LeafType, leafBytes LeafBytes) LeafContainer {
	return LeafContainer{LeafType: leafType, LeafBytes: leafBytes}
}

func (c LeafContainer) Serialize() ([]byte, error) {
	return msgpack.EncodeCanonical(c)
}

type ID []byte
type Revelations map[keybase1.SeqType]keybase1.Seqno

type Leaf interface {
	Serialize() ([]byte, error)
	Type() LeafType
	ID() ID
	GetRevelations() Revelations
}

type SigID []byte
type Teamv1HiddenTail struct {
	_struct bool `codec:",toarray"` //nolint
	SigID   SigID
	LinkID  sig3.LinkID
	Seqno   keybase1.Seqno
}

type Teamv1Leaf struct {
	_struct bool `codec:",toarray"` //nolint
	// do not encode teamID; it's redundant in the tree
	TeamID sig3.TeamID `codec:"-"`
	Tails  map[keybase1.SeqType]Teamv1HiddenTail
}

var _ Leaf = (*Teamv1Leaf)(nil)

func (l Teamv1Leaf) Serialize() ([]byte, error) {
	return msgpack.EncodeCanonical(l)
}

func (l Teamv1Leaf) Type() LeafType {
	return LeafTypeTeamv1
}

func (l Teamv1Leaf) ID() ID {
	return ID(l.TeamID[:])
}

func (l Teamv1Leaf) GetRevelations() Revelations {
	m := make(map[keybase1.SeqType]keybase1.Seqno)
	for chainType, tail := range l.Tails {
		m[chainType] = tail.Seqno
	}
	return m
}

func ExportLeaf(l Leaf) (LeafContainer, error) {
	b, err := l.Serialize()
	if err != nil {
		return LeafContainer{}, errors.Wrap(err, "failed to serialize leaf")
	}
	return NewLeafContainer(l.Type(), b), nil
}

type HashMeta []byte
type Skips map[TreeSeqno]HashMeta
type RootHash []byte

type RootMetadata struct {
	_struct      bool         `codec:",toarray"` //nolint
	EncodingType EncodingType `codec:"e"`
	Seqno        TreeSeqno    `codec:"s"`
	Skips        Skips        `codec:"t"` // includes prev
	Hash         RootHash     `codec:"r"`
}

func (r RootMetadata) EncodingAndHashMeta() (encoding []byte, hashMeta HashMeta, err error) {
	b, err := msgpack.EncodeCanonical(r)
	if err != nil {
		return nil, nil, err
	}
	h := sha512.Sum512_256(b)
	return b, h[:], nil
}

func (r RootMetadata) HashMeta() (HashMeta, error) {
	_, hashMeta, err := r.EncodingAndHashMeta()
	return hashMeta, err
}

type BlindedEntropy []byte

type BlindedPreimage struct {
	LeafContainer  LeafContainer
	BlindedEntropy BlindedEntropy
}

func NewBlindedPreimage(leaf Leaf, blindedEntropy BlindedEntropy) (BlindedPreimage, error) {
	container, err := ExportLeaf(leaf)
	if err != nil {
		return BlindedPreimage{}, err
	}
	return BlindedPreimage{LeafContainer: container, BlindedEntropy: blindedEntropy}, nil
}

type Skiplist = []RootMetadata
type Path = []merkletree.Node
type QueryResponse struct {
	RootMetadata    RootMetadata    `codec:"r,omitempty"`
	Path            Path            `codec:"p,omitempty"`
	BlindedPreimage BlindedPreimage `codec:"v,omitempty"`
	Skiplists       []Skiplist      `codec:"s,omitempty"`
}
type HistoricalQueryResponse struct {
	RootMetadata     RootMetadata      `codec:"r,omitempty"`
	Paths            []Path            `codec:"p,omitempty"`
	BlindedPreimages []BlindedPreimage `codec:"v,omitempty"`
	Skiplists        []Skiplist        `codec:"s,omitempty"`
}

type Key struct {
	Key []byte
}

func NewKey(key []byte) Key {
	return Key{Key: key}
}

type Secret struct {
	Secret []byte
}

func NewSecret(secret []byte) Secret {
	return Secret{Secret: secret}
}

package sigchain3

import ()

type UID [16]byte
type LinkType int
type ChainType int
type SigVersion int
type LinkID []byte
type Seqno int
type Time uint
type SigIgnoreIfUnsupported bool
type KID []byte

// These values are picked so they don't conflict with Sigchain V1 and V2 link types
const (
	LinkTypeNone          LinkType = 0
	LinkTypeSecretSummary LinkType = 65
	LinkTypePassiveFollow LinkType = 66
	LinkTypeTeamPTK       LinkType = 81
)

// The values are picked so they don't conflict with Sigchain V1 and V2 SeqType's
const (
	ChainTypeUserPrivate ChainType = 16
	ChainTypeTeamPrivate ChainType = 17
)

// OuterLink V3 is the third version of Keybase sigchain signatures, it roughly approximates
// the outer link v2s that we have previously used.
type OuterLink struct {
	_struct             bool                   `codec:",toarray"`
	Version             SigVersion             `codec:"version"` // comment should be 3
	Seqno               Seqno                  `codec:"seqno"`
	Prev                LinkID                 `codec:"prev"`
	Curr                LinkID                 `codec:"curr"`
	LinkType            LinkType               `codec:"type"`
	ChainType           ChainType              `codec:"chaintype"`
	IgnoreIfUnsupported SigIgnoreIfUnsupported `codec:"ignore_if_unsupported"`
	// New field for V3; if this link is encrypted, specify the format, nonce and PUK
	EncParams *EncryptionParameters `codec:"encryption_parameters"`
}

type InnerLink struct {
	_struct         bool        `codec:",toarray"`
	SigningKeySeqno Seqno       `codec:"key_seqno"`   // the signing key, given by the sequence of the user's sigchain; implies an eldest seqno
	Ctime           Time        `codec:"ctime"`       // Seconds since 1970 UTC.
	MerkleRoot      *MerkleRoot `codec:"merkle_root"` // Optional snapshot of merkle root at time of sig
	Client          *Client     `codec:"client"`      // Optional client type making sig
	Body            interface{} `codec:"body"`        // The actual body, which varies based on the type in the outer link
}

type PassiveFollow struct {
	_struct bool          `codec:",toarray"`
	Follows map[UID]Seqno `codec:"follows"`
}

type SecretSummary struct {
	Follows map[UID]Seqno `codec:"follows"`
}

type MerkleRoot struct {
	_struct bool   `codec:",toarray"`
	Hash    []byte `codec:"hash"`
	Seqno   Seqno  `codec:"seqno"`
	Ctime   Time   `codec:"ctime"`
}

type Client struct {
	_struct bool   `codec:",toarray"`
	Desc    string `codec:"description"`
	Version string `codec:"version"`
}

// If the inner link is encrypted, we specify the encryption parameters
// with this offloaded structure. So far, we don't know of any such encrypted
// payloads, but we'll allow it.
type EncryptionParameters struct {
	_struct bool   `codec:",toarray"`
	Version int    `codec:"version"`
	KID     KID    `codec:"kid"`
	Nonce   []byte `codec:"nonce"`
}

type Tail struct {
	_struct bool      `codec:",toarray"`
	SeqType ChainType `codec:"seqtype"`
	Seqno   Seqno     `codec:"seqno"`
	Hash    LinkID    `codec:"hash"`
}

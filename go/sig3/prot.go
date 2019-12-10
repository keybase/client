package sig3

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type UID [16]byte
type LinkType int
type ChainType = keybase1.SeqType
type SigVersion int
type LinkID [32]byte
type Seqno = keybase1.Seqno
type Time = keybase1.Time
type TimeSec int64
type IgnoreIfUnsupported bool
type KID = keybase1.BinaryKID
type TeamID [16]byte
type PerTeamKeyGeneration = keybase1.PerTeamKeyGeneration
type Entropy []byte
type Sig [64]byte
type PTKType = keybase1.PTKType
type AppkeyDerivationVersion int

const (
	SigVersion3 SigVersion = 3
)

const (
	AppkeyDerivationXOR AppkeyDerivationVersion = 1
)

// These values are picked so they don't conflict with Sigchain V1 and V2 link types
const (
	LinkTypeNone      LinkType = 0
	LinkTypeUserPeg   LinkType = 65
	LinkTypeRotateKey LinkType = 81
)

// The values are picked so they don't conflict with Sigchain V1 and V2 SeqType's
const (
	ChainTypeUserPrivateHidden = keybase1.SeqType_USER_PRIVATE_HIDDEN
	ChainTypeTeamPrivateHidden = keybase1.SeqType_TEAM_PRIVATE_HIDDEN
)

// OuterLink V3 is the third version of Keybase sigchain signatures, it roughly approximates
// the outer link v2s that we have previously used.
type OuterLink struct {
	_struct             bool                `codec:",toarray"` //nolint
	Version             SigVersion          `codec:"version"`  // should be 3
	Seqno               Seqno               `codec:"seqno"`
	Prev                *LinkID             `codec:"prev"`
	InnerLinkID         LinkID              `codec:"curr"` // hash of the msgpack of the InnerLink
	LinkType            LinkType            `codec:"type"` // hash of the msgpack of the previous OuterLink
	ChainType           ChainType           `codec:"chaintype"`
	IgnoreIfUnsupported IgnoreIfUnsupported `codec:"ignore_if_unsupported"`
	// New field for V3; if this link is encrypted, specify the format, nonce and PUK
	EncryptionParameters *EncryptionParameters `codec:"encryption_parameters"`
}

type InnerLink struct {
	Body        interface{} `codec:"b"`           // The actual body, which varies based on the type in the outer link
	Ctime       TimeSec     `codec:"c"`           // Seconds since 1970 UTC.
	Entropy     Entropy     `codec:"e"`           // entropy for hiding the value of the inner link
	ClientInfo  *ClientInfo `codec:"i,omitempty"` // Optional client type making sig
	MerkleRoot  MerkleRoot  `codec:"m"`           // Optional snapshot of merkle root at time of sig
	ParentChain Tail        `codec:"p"`           // grab of the most-recent chain tail of the corresponding parent chain
	Signer      Signer      `codec:"s"`           // Info on the signer, including UID, KID and eldest
	Team        *Team       `codec:"t"`           // for teams, and null otherwise
}

type Signer struct {
	EldestSeqno keybase1.Seqno `codec:"e"`
	KID         KID            `codec:"k"`
	UID         UID            `codec:"u"`
}

type Team struct {
	Admin      *ChainLocation `codec:"a,omitempty"` // If working as an implicit admin, where that permission comes from
	TeamID     TeamID         `codec:"i"`
	IsImplicit bool           `codec:"m"`
	IsPublic   bool           `codec:"p"`
}

type ChainLocation struct {
	TeamID    TeamID    `codec:"i"`
	Seqno     Seqno     `codec:"s"`
	ChainType ChainType `codec:"t"`
}

type MerkleRoot struct {
	Ctime TimeSec `codec:"c"`
	Hash  []byte  `codec:"h"` // HashMeta of the MerkleRoot
	Seqno Seqno   `codec:"s"`
}

type ClientInfo struct {
	Desc    string `codec:"d"`
	Version string `codec:"v"`
}

// If the inner link is encrypted, we specify the encryption parameters
// with this offloaded structure. So far, we don't know of any such encrypted
// payloads, but we'll allow it.
type EncryptionParameters struct {
	KID     KID    `codec:"k"`
	Nonce   []byte `codec:"n"`
	Version int    `codec:"v"`
}

type Tail struct {
	Hash      LinkID    `codec:"h" json:"link_id"` // hash of the outer link
	Seqno     Seqno     `codec:"s" json:"seqno"`
	ChainType ChainType `codec:"t" json:"chain_type"`
}

type RotateKeyBody struct {
	PTKs []PerTeamKey `codec:"k"`
}

type PerTeamKey struct {
	AppkeyDerivationVersion AppkeyDerivationVersion            `codec:"a"`
	SeedCheck               keybase1.PerTeamSeedCheckPostImage `codec:"c"` // SHA256(f(i)); see teams.avdl for f(i) definition
	EncryptionKID           KID                                `codec:"e"`
	Generation              PerTeamKeyGeneration               `codec:"g"`
	ReverseSig              *Sig                               `codec:"r"` // Can be null if we are checking sigs
	SigningKID              KID                                `codec:"s"`
	PTKType                 PTKType                            `codec:"t"`
}

// Sig3ExportJSON is for communicating with the API server.
type ExportJSON struct {
	Inner string `json:"i,omitempty"`
	Outer string `json:"o,omitempty"`
	Sig   string `json:"s,omitempty"`
}

// Sig3Bundle is for storing sig3 links locally
type Sig3Bundle struct {
	Inner *InnerLink `json:"i,omitempty"`
	Outer OuterLink  `json:"o"`
	Sig   *Sig       `json:"s,omitempty"`
}

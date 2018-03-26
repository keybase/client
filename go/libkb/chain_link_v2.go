package libkb

import (
	"encoding/base64"
	"errors"
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
)

// See comment at top of sig_chain.go for a description of V1, V2 and
// V2 stubbed sigchain links.

type SigchainV2Type int

// These values must match constants.iced in the proofs library.
const (
	SigchainV2TypeNone                        SigchainV2Type = 0
	SigchainV2TypeEldest                      SigchainV2Type = 1
	SigchainV2TypeWebServiceBinding           SigchainV2Type = 2
	SigchainV2TypeTrack                       SigchainV2Type = 3
	SigchainV2TypeUntrack                     SigchainV2Type = 4
	SigchainV2TypeRevoke                      SigchainV2Type = 5
	SigchainV2TypeCryptocurrency              SigchainV2Type = 6
	SigchainV2TypeAnnouncement                SigchainV2Type = 7
	SigchainV2TypeDevice                      SigchainV2Type = 8
	SigchainV2TypeWebServiceBindingWithRevoke SigchainV2Type = 9
	SigchainV2TypeCryptocurrencyWithRevoke    SigchainV2Type = 10
	SigchainV2TypeSibkey                      SigchainV2Type = 11
	SigchainV2TypeSubkey                      SigchainV2Type = 12
	SigchainV2TypePGPUpdate                   SigchainV2Type = 13
	SigchainV2TypePerUserKey                  SigchainV2Type = 14
	SigchainV2TypeWallet                      SigchainV2Type = 15

	// Team link types
	// If you add a new one be sure to get all of these too:
	// - A corresponding libkb.LinkType in constants.go
	// - SigchainV2TypeFromV1TypeTeams
	// - SigChainV2Type.IsSupportedTeamType
	// - SigChainV2Type.RequiresAdminPermission
	// - SigChainV2Type.TeamAllowStub
	// - TeamSigChainPlayer.addInnerLink (add a case)
	SigchainV2TypeTeamRoot             SigchainV2Type = 33
	SigchainV2TypeTeamNewSubteam       SigchainV2Type = 34
	SigchainV2TypeTeamChangeMembership SigchainV2Type = 35
	SigchainV2TypeTeamRotateKey        SigchainV2Type = 36
	SigchainV2TypeTeamLeave            SigchainV2Type = 37
	SigchainV2TypeTeamSubteamHead      SigchainV2Type = 38
	SigchainV2TypeTeamRenameSubteam    SigchainV2Type = 39
	SigchainV2TypeTeamInvite           SigchainV2Type = 40
	SigchainV2TypeTeamRenameUpPointer  SigchainV2Type = 41
	SigchainV2TypeTeamDeleteRoot       SigchainV2Type = 42
	SigchainV2TypeTeamDeleteSubteam    SigchainV2Type = 43
	SigchainV2TypeTeamDeleteUpPointer  SigchainV2Type = 44
	// Note that 45 is skipped, since it's retired; used to be LegacyTLFUpgrade
	SigchainV2TypeTeamSettings     SigchainV2Type = 46
	SigchainV2TypeTeamKBFSSettings SigchainV2Type = 47
)

func (t SigchainV2Type) NeedsSignature() bool {
	switch t {
	case SigchainV2TypeTrack, SigchainV2TypeUntrack, SigchainV2TypeAnnouncement:
		return false
	default:
		return true
	}
}

// Whether a type is for team sigchains.
// Also the list of which types are supported by this client.
func (t SigchainV2Type) IsSupportedTeamType() bool {
	switch t {
	case SigchainV2TypeTeamRoot,
		SigchainV2TypeTeamNewSubteam,
		SigchainV2TypeTeamChangeMembership,
		SigchainV2TypeTeamRotateKey,
		SigchainV2TypeTeamLeave,
		SigchainV2TypeTeamSubteamHead,
		SigchainV2TypeTeamRenameSubteam,
		SigchainV2TypeTeamInvite,
		SigchainV2TypeTeamRenameUpPointer,
		SigchainV2TypeTeamDeleteRoot,
		SigchainV2TypeTeamDeleteSubteam,
		SigchainV2TypeTeamDeleteUpPointer,
		SigchainV2TypeTeamKBFSSettings,
		SigchainV2TypeTeamSettings:
		return true
	default:
		return false
	}
}

func (t SigchainV2Type) RequiresAtLeastRole() keybase1.TeamRole {
	if !t.IsSupportedTeamType() {
		// Links from the future require a bare minimum.
		// They should be checked later by a code update that busts the cache.
		return keybase1.TeamRole_READER
	}
	switch t {
	case SigchainV2TypeTeamRoot,
		SigchainV2TypeTeamLeave:
		return keybase1.TeamRole_READER
	case SigchainV2TypeTeamRotateKey:
		return keybase1.TeamRole_WRITER
	default:
		return keybase1.TeamRole_ADMIN
	}
}

func (t SigchainV2Type) TeamAllowStubWithAdminFlag(isAdmin bool) bool {
	role := keybase1.TeamRole_READER
	if isAdmin {
		role = keybase1.TeamRole_ADMIN
	}
	return t.TeamAllowStub(role)
}

// Whether the type can be stubbed for a team member with role
func (t SigchainV2Type) TeamAllowStub(role keybase1.TeamRole) bool {
	if role.IsAdminOrAbove() {
		// Links cannot be stubbed for owners and admins
		return false
	}
	switch t {
	case SigchainV2TypeTeamNewSubteam,
		SigchainV2TypeTeamRenameSubteam,
		SigchainV2TypeTeamDeleteSubteam,
		SigchainV2TypeTeamInvite:
		return true
	default:
		// Disallow stubbing of other known links.
		// Allow stubbing of unknown link types for forward compatibility.
		return !t.IsSupportedTeamType()
	}
}

// OuterLinkV2 is the second version of Keybase sigchain signatures.
type OuterLinkV2 struct {
	_struct  bool           `codec:",toarray"`
	Version  int            `codec:"version"`
	Seqno    keybase1.Seqno `codec:"seqno"`
	Prev     LinkID         `codec:"prev"`
	Curr     LinkID         `codec:"curr"`
	LinkType SigchainV2Type `codec:"type"`
	// -- Links exist in the wild that are missing fields below this line.
	SeqType keybase1.SeqType `codec:"seqtype"`
	// -- Links exist in the wild that are missing fields below this line too.
	// Whether the link can be ignored by clients that do not support its link type.
	// This does _not_ mean the link can be ignored if the client supports the link type.
	// When it comes to stubbing, if the link is unsupported and this bit is set then
	// - it can be stubbed for non-admins
	// - it cannot be stubbed for admins
	IgnoreIfUnsupported bool `codec:"ignore_if_unsupported"`
}

func (o OuterLinkV2) Encode() ([]byte, error) {
	return MsgpackEncode(o)
}

type OuterLinkV2WithMetadata struct {
	OuterLinkV2
	raw   []byte
	sigID keybase1.SigID
	sig   string
	kid   keybase1.KID
}

// An OuterLinkV2WithMetadata should never be encoded/decoded
// directly. This is to avoid problems like
// https://github.com/keybase/saltpack/pull/43 .

var _ codec.Selfer = (*OuterLinkV2WithMetadata)(nil)

var errCodecEncodeSelf = errors.New("Unexpected call to OuterLinkV2WithMetadata.CodecEncodeSelf")
var errCodecDecodeSelf = errors.New("Unexpected call to OuterLinkV2WithMetadata.CodecDecodeSelf")

func (o *OuterLinkV2WithMetadata) CodecEncodeSelf(e *codec.Encoder) {
	panic(errCodecEncodeSelf)
}

func (o *OuterLinkV2WithMetadata) CodecDecodeSelf(d *codec.Decoder) {
	panic(errCodecDecodeSelf)
}

type SigIgnoreIfUnsupported bool
type SigHasRevokes bool

func MakeSigchainV2OuterSig(
	signingKey GenericKey,
	v1LinkType LinkType,
	seqno keybase1.Seqno,
	innerLinkJSON []byte,
	prevLinkID LinkID,
	hasRevokes SigHasRevokes,
	seqType keybase1.SeqType,
	ignoreIfUnsupported SigIgnoreIfUnsupported,
) (sig string, sigid keybase1.SigID, linkID LinkID, err error) {
	currLinkID := ComputeLinkID(innerLinkJSON)

	v2LinkType, err := SigchainV2TypeFromV1TypeAndRevocations(string(v1LinkType), hasRevokes)
	if err != nil {
		return sig, sigid, linkID, err
	}

	outerLink := OuterLinkV2{
		Version:             2,
		Seqno:               seqno,
		Prev:                prevLinkID,
		Curr:                currLinkID,
		LinkType:            v2LinkType,
		SeqType:             seqType,
		IgnoreIfUnsupported: bool(ignoreIfUnsupported),
	}
	encodedOuterLink, err := outerLink.Encode()
	if err != nil {
		return sig, sigid, linkID, err
	}

	sig, sigid, err = signingKey.SignToString(encodedOuterLink)
	if err != nil {
		return sig, sigid, linkID, err
	}

	linkID = ComputeLinkID(encodedOuterLink)
	return sig, sigid, linkID, nil
}

func DecodeStubbedOuterLinkV2(b64encoded string) (*OuterLinkV2WithMetadata, error) {
	payload, err := base64.StdEncoding.DecodeString(b64encoded)
	if err != nil {
		return nil, err
	}
	var ol OuterLinkV2
	err = MsgpackDecode(&ol, payload)
	if err != nil {
		return nil, err
	}
	return &OuterLinkV2WithMetadata{OuterLinkV2: ol, raw: payload}, nil
}

func (o OuterLinkV2WithMetadata) EncodeStubbed() string {
	return base64.StdEncoding.EncodeToString(o.raw)
}

func (o OuterLinkV2WithMetadata) LinkID() LinkID {
	return ComputeLinkID(o.raw)
}

func (o OuterLinkV2WithMetadata) Raw() []byte {
	return o.raw
}

func (o OuterLinkV2WithMetadata) Verify(ctx VerifyContext) (kid keybase1.KID, err error) {
	key, err := ImportKeypairFromKID(o.kid)
	if err != nil {
		return kid, err
	}
	_, err = key.VerifyString(ctx, o.sig, o.raw)
	if err != nil {
		return kid, err
	}
	return o.kid, nil
}

func DecodeOuterLinkV2(armored string) (*OuterLinkV2WithMetadata, error) {
	payload, kid, sigID, err := SigExtractPayloadAndKID(armored)
	if err != nil {
		return nil, err
	}
	var ol OuterLinkV2
	err = MsgpackDecode(&ol, payload)
	if err != nil {
		return nil, err
	}
	ret := OuterLinkV2WithMetadata{
		OuterLinkV2: ol,
		sigID:       sigID,
		raw:         payload,
		kid:         kid,
		sig:         armored,
	}
	return &ret, nil
}

func SigchainV2TypeFromV1TypeAndRevocations(s string, hasRevocations SigHasRevokes) (ret SigchainV2Type, err error) {

	switch s {
	case "eldest":
		ret = SigchainV2TypeEldest
	case "web_service_binding":
		if hasRevocations {
			ret = SigchainV2TypeWebServiceBindingWithRevoke
		} else {
			ret = SigchainV2TypeWebServiceBinding
		}
	case "track":
		ret = SigchainV2TypeTrack
	case "untrack":
		ret = SigchainV2TypeUntrack
	case "revoke":
		ret = SigchainV2TypeRevoke
	case "cryptocurrency":
		if hasRevocations {
			ret = SigchainV2TypeCryptocurrencyWithRevoke
		} else {
			ret = SigchainV2TypeCryptocurrency
		}
	case "announcement":
		ret = SigchainV2TypeAnnouncement
	case "device":
		ret = SigchainV2TypeDevice
	case "sibkey":
		ret = SigchainV2TypeSibkey
	case "subkey":
		ret = SigchainV2TypeSubkey
	case "pgp_update":
		ret = SigchainV2TypePGPUpdate
	case "per_user_key":
		ret = SigchainV2TypePerUserKey
	case "wallet":
		ret = SigchainV2TypeWallet
	default:
		teamRes, teamErr := SigchainV2TypeFromV1TypeTeams(s)
		if teamErr == nil {
			ret = teamRes
		} else {
			ret = SigchainV2TypeNone
			err = ChainLinkError{fmt.Sprintf("Unknown sig v1 type: %s", s)}
		}
	}

	if !ret.NeedsSignature() && bool(hasRevocations) {
		err = ChainLinkError{fmt.Sprintf("invalid chain link of type %d with a revocation", ret)}
	}

	return ret, err
}

func SigchainV2TypeFromV1TypeTeams(s string) (ret SigchainV2Type, err error) {
	switch LinkType(s) {
	case LinkTypeTeamRoot:
		ret = SigchainV2TypeTeamRoot
	case LinkTypeNewSubteam:
		ret = SigchainV2TypeTeamNewSubteam
	case LinkTypeChangeMembership:
		ret = SigchainV2TypeTeamChangeMembership
	case LinkTypeRotateKey:
		ret = SigchainV2TypeTeamRotateKey
	case LinkTypeLeave:
		ret = SigchainV2TypeTeamLeave
	case LinkTypeSubteamHead:
		ret = SigchainV2TypeTeamSubteamHead
	case LinkTypeRenameSubteam:
		ret = SigchainV2TypeTeamRenameSubteam
	case LinkTypeInvite:
		ret = SigchainV2TypeTeamInvite
	case LinkTypeRenameUpPointer:
		ret = SigchainV2TypeTeamRenameUpPointer
	case LinkTypeDeleteRoot:
		ret = SigchainV2TypeTeamDeleteRoot
	case LinkTypeDeleteSubteam:
		ret = SigchainV2TypeTeamDeleteSubteam
	case LinkTypeDeleteUpPointer:
		ret = SigchainV2TypeTeamDeleteUpPointer
	case LinkTypeKBFSSettings:
		ret = SigchainV2TypeTeamKBFSSettings
	case LinkTypeSettings:
		ret = SigchainV2TypeTeamSettings
	default:
		return SigchainV2TypeNone, ChainLinkError{fmt.Sprintf("Unknown team sig v1 type: %s", s)}
	}

	return ret, err
}

func (o OuterLinkV2) AssertFields(
	version int,
	seqno keybase1.Seqno,
	prev LinkID,
	curr LinkID,
	linkType SigchainV2Type,
	seqType keybase1.SeqType,
	ignoreIfUnsupported bool,
) (err error) {
	mkErr := func(format string, arg ...interface{}) error {
		return SigchainV2MismatchedFieldError{fmt.Sprintf(format, arg...)}
	}
	if o.Version != version {
		return mkErr("version field (%d != %d)", o.Version, version)
	}
	if o.Seqno != seqno {
		return mkErr("seqno field: (%d != %d)", o.Seqno, seqno)
	}
	if !o.Prev.Eq(prev) {
		return mkErr("prev pointer: (%s != !%s)", o.Prev, prev)
	}
	if !o.Curr.Eq(curr) {
		return mkErr("curr pointer: (%s != %s)", o.Curr, curr)
	}
	if o.LinkType != linkType {
		return mkErr("link type: (%d != %d)", o.LinkType, linkType)
	}
	if o.SeqType != seqType {
		return mkErr("seq type: (%d != %d)", o.SeqType, seqType)
	}
	if o.IgnoreIfUnsupported != ignoreIfUnsupported {
		return mkErr("ignore_if_unsupported: (%v != %v)", o.IgnoreIfUnsupported, ignoreIfUnsupported)
	}
	return nil
}

func (o OuterLinkV2) AssertSomeFields(
	version int,
	seqno keybase1.Seqno,
) (err error) {
	mkErr := func(format string, arg ...interface{}) error {
		return SigchainV2MismatchedFieldError{fmt.Sprintf(format, arg...)}
	}
	if o.Version != version {
		return mkErr("version field (%d != %d)", o.Version, version)
	}
	if o.Seqno != seqno {
		return mkErr("seqno field: (%d != %d)", o.Seqno, seqno)
	}
	return nil
}

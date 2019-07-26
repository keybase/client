package libkb

import (
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/msgpack"
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
	SigchainV2TypeWalletStellar               SigchainV2Type = 15

	// Team link types
	// If you add a new one be sure to get all of these too:
	// - A corresponding libkb.LinkType in constants.go
	// - SigchainV2TypeFromV1TypeTeams
	// - SigChainV2Type.IsSupportedTeamType
	// - SigChainV2Type.TeamAllowStubWithAdminFlag
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
	SigchainV2TypeTeamBotSettings  SigchainV2Type = 48
)

// NeedsSignature is untrue of most supported link types. If a link can
// be stubbed, that means we potentially won't get to verify its signature,
// since we need the full link to verify signatures. However, in some cases,
// signature verification is required, and hence stubbing is disallowed.
// NOTE when modifying this function ensure that web/sig.iced#_allow_stubbing
// is updated as well.
func (t SigchainV2Type) AllowStubbing() bool {

	// Unsupported types don't need signatures. Otherwise we can't
	// make code forwards-compatible.
	if !t.IsSupportedUserType() {
		return true
	}

	// Of known types, Track, Untrack and Announcement can be stubbed, but
	// nothing else, for now....
	switch t {
	case SigchainV2TypeTrack, SigchainV2TypeUntrack, SigchainV2TypeAnnouncement:
		return true
	default:
		return false
	}
}

// NOTE when modifying this function ensure that web/sig.iced#_is_supported_user_type
// is updated as well.
func (t SigchainV2Type) IsSupportedUserType() bool {
	switch t {
	case SigchainV2TypeNone,
		SigchainV2TypeEldest,
		SigchainV2TypeWebServiceBinding,
		SigchainV2TypeTrack,
		SigchainV2TypeUntrack,
		SigchainV2TypeRevoke,
		SigchainV2TypeCryptocurrency,
		SigchainV2TypeAnnouncement,
		SigchainV2TypeDevice,
		SigchainV2TypeWebServiceBindingWithRevoke,
		SigchainV2TypeCryptocurrencyWithRevoke,
		SigchainV2TypeSibkey,
		SigchainV2TypeSubkey,
		SigchainV2TypePGPUpdate,
		SigchainV2TypePerUserKey,
		SigchainV2TypeWalletStellar:
		return true
	default:
		return false
	}
}

func (t SigchainV2Type) IsSupportedType() bool {
	return t.IsSupportedTeamType() || t.IsSupportedUserType()
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
		SigchainV2TypeTeamSettings,
		SigchainV2TypeTeamBotSettings:
		return true
	default:
		return false
	}
}

func (t SigchainV2Type) RequiresAtLeastRole() keybase1.TeamRole {
	if !t.IsSupportedTeamType() {
		// Links from the future require a bare minimum.
		// They should be checked later by a code update that busts the cache.
		return keybase1.TeamRole_RESTRICTEDBOT
	}
	switch t {
	case SigchainV2TypeTeamLeave:
		return keybase1.TeamRole_RESTRICTEDBOT
	case SigchainV2TypeTeamRoot:
		return keybase1.TeamRole_BOT
	case SigchainV2TypeTeamRotateKey,
		SigchainV2TypeTeamKBFSSettings:
		return keybase1.TeamRole_WRITER
	default:
		return keybase1.TeamRole_ADMIN
	}
}

func (t SigchainV2Type) TeamAllowStubWithAdminFlag(isAdmin bool) bool {
	if isAdmin {
		// Links cannot be stubbed for owners and admins
		return false
	}
	switch t {
	case SigchainV2TypeTeamNewSubteam,
		SigchainV2TypeTeamRenameSubteam,
		SigchainV2TypeTeamDeleteSubteam,
		SigchainV2TypeTeamInvite,
		SigchainV2TypeTeamSettings,
		SigchainV2TypeTeamKBFSSettings,
		SigchainV2TypeTeamBotSettings:
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
	Version  SigVersion     `codec:"version"`
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
	IgnoreIfUnsupported SigIgnoreIfUnsupported `codec:"ignore_if_unsupported"`
	// -- Links exist in the wild that are missing fields below this line too.
	// If not provided, both of these are nil, and highSkip in the inner link is set to nil.
	// Note that a link providing HighSkipSeqno == 0 and HighSkipHash == nil is valid
	// (and mandatory) for an initial link.
	HighSkipSeqno *keybase1.Seqno `codec:"high_skip_seqno"`
	HighSkipHash  *LinkID         `codec:"high_skip_hash"`
}

func (o OuterLinkV2) Encode() ([]byte, error) {
	return msgpack.Encode(o)
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

func (b SigIgnoreIfUnsupported) Bool() bool { return bool(b) }

func encodeOuterLink(
	m MetaContext,
	v1LinkType LinkType,
	seqno keybase1.Seqno,
	innerLinkJSON []byte,
	prevLinkID LinkID,
	hasRevokes SigHasRevokes,
	seqType keybase1.SeqType,
	ignoreIfUnsupported SigIgnoreIfUnsupported,
	highSkip *HighSkip,
) ([]byte, error) {
	var encodedOuterLink []byte

	currLinkID := ComputeLinkID(innerLinkJSON)

	v2LinkType, err := SigchainV2TypeFromV1TypeAndRevocations(string(v1LinkType), hasRevokes, ignoreIfUnsupported)
	if err != nil {
		return encodedOuterLink, err
	}

	// When 2.3 links are mandatory, it will be invalid for highSkip == nil,
	// so the featureflag check will be removed and the nil check will result
	// in an error.
	allowHighSkips := m.G().Env.GetFeatureFlags().HasFeature(EnvironmentFeatureAllowHighSkips)
	if allowHighSkips && highSkip != nil {
		highSkipSeqno := &highSkip.Seqno
		highSkipHash := &highSkip.Hash
		outerLink := OuterLinkV2{
			Version:             2,
			Seqno:               seqno,
			Prev:                prevLinkID,
			Curr:                currLinkID,
			LinkType:            v2LinkType,
			SeqType:             seqType,
			IgnoreIfUnsupported: ignoreIfUnsupported,
			HighSkipSeqno:       highSkipSeqno,
			HighSkipHash:        highSkipHash,
		}
		encodedOuterLink, err = outerLink.Encode()
	} else {
		// This is a helper struct. When the code for Sigchain 2.3
		// is released, it is possible some clients will still post 2.2
		// links, i.e., without high_skip information. Due to a bug
		// in Keybase's fork of go-codec, omitempty does not work
		// for arrays. So, we send up the serialization of the
		// appropriate struct depending on whether we are making a 2.3 link.
		// When 2.3 links are mandatory, this struct can be deleted.
		encodedOuterLink, err = msgpack.Encode(
			struct {
				_struct             bool                   `codec:",toarray"`
				Version             int                    `codec:"version"`
				Seqno               keybase1.Seqno         `codec:"seqno"`
				Prev                LinkID                 `codec:"prev"`
				Curr                LinkID                 `codec:"curr"`
				LinkType            SigchainV2Type         `codec:"type"`
				SeqType             keybase1.SeqType       `codec:"seqtype"`
				IgnoreIfUnsupported SigIgnoreIfUnsupported `codec:"ignore_if_unsupported"`
			}{
				Version:             2,
				Seqno:               seqno,
				Prev:                prevLinkID,
				Curr:                currLinkID,
				LinkType:            v2LinkType,
				SeqType:             seqType,
				IgnoreIfUnsupported: ignoreIfUnsupported,
			})
	}

	if err != nil {
		return encodedOuterLink, err
	}

	return encodedOuterLink, err
}

func MakeSigchainV2OuterSig(
	m MetaContext,
	signingKey GenericKey,
	v1LinkType LinkType,
	seqno keybase1.Seqno,
	innerLinkJSON []byte,
	prevLinkID LinkID,
	hasRevokes SigHasRevokes,
	seqType keybase1.SeqType,
	ignoreIfUnsupported SigIgnoreIfUnsupported,
	highSkip *HighSkip,
) (sig string, sigid keybase1.SigID, linkID LinkID, err error) {

	encodedOuterLink, err := encodeOuterLink(m, v1LinkType, seqno, innerLinkJSON, prevLinkID, hasRevokes, seqType, ignoreIfUnsupported, highSkip)
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
	if !msgpack.IsEncodedMsgpackArray(payload) {
		return nil, ChainLinkError{"expected a msgpack array but got leading junk"}
	}
	var ol OuterLinkV2
	if err = msgpack.Decode(&ol, payload); err != nil {
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

func (o OuterLinkV2WithMetadata) SigID() keybase1.SigID {
	return o.sigID
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
	if !msgpack.IsEncodedMsgpackArray(payload) {
		return nil, ChainLinkError{"expected a msgpack array but got leading junk"}
	}

	var ol OuterLinkV2
	if err := msgpack.Decode(&ol, payload); err != nil {
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

func SigchainV2TypeFromV1TypeAndRevocations(s string, hasRevocations SigHasRevokes, ignoreIfUnsupported SigIgnoreIfUnsupported) (ret SigchainV2Type, err error) {

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
	case string(LinkTypeWalletStellar):
		ret = SigchainV2TypeWalletStellar
	default:
		teamRes, teamErr := SigchainV2TypeFromV1TypeTeams(s)
		if teamErr == nil {
			ret = teamRes
		} else {
			ret = SigchainV2TypeNone
			if !ignoreIfUnsupported {
				err = ChainLinkError{fmt.Sprintf("Unknown sig v1 type: %s", s)}
			}
		}
	}

	if ret.AllowStubbing() && bool(hasRevocations) {
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
	case LinkTypeTeamBotSettings:
		ret = SigchainV2TypeTeamBotSettings
	default:
		return SigchainV2TypeNone, ChainLinkError{fmt.Sprintf("Unknown team sig v1 type: %s", s)}
	}

	return ret, err
}

func mismatchError(format string, arg ...interface{}) error {
	return SigchainV2MismatchedFieldError{fmt.Sprintf(format, arg...)}
}

func (o OuterLinkV2) AssertFields(
	version SigVersion,
	seqno keybase1.Seqno,
	prev LinkID,
	curr LinkID,
	linkType SigchainV2Type,
	seqType keybase1.SeqType,
	ignoreIfUnsupported SigIgnoreIfUnsupported,
	highSkip *HighSkip,
) (err error) {
	if o.Version != version {
		return mismatchError("version field (%d != %d)", o.Version, version)
	}
	if o.Seqno != seqno {
		return mismatchError("seqno field: (%d != %d)", o.Seqno, seqno)
	}
	if !o.Prev.Eq(prev) {
		return mismatchError("prev pointer: (%s != !%s)", o.Prev, prev)
	}
	if !o.Curr.Eq(curr) {
		return mismatchError("curr pointer: (%s != %s)", o.Curr, curr)
	}
	if !(linkType == SigchainV2TypeNone && ignoreIfUnsupported) && o.LinkType != linkType {
		return mismatchError("link type: (%d != %d)", o.LinkType, linkType)
	}
	if o.SeqType != seqType {
		return mismatchError("seq type: (%d != %d)", o.SeqType, seqType)
	}
	if o.IgnoreIfUnsupported != ignoreIfUnsupported {
		return mismatchError("ignore_if_unsupported: (%v != %v)", o.IgnoreIfUnsupported, ignoreIfUnsupported)
	}

	err = o.assertHighSkip(highSkip)
	if err != nil {
		return err
	}

	return nil
}

func (o OuterLinkV2) assertHighSkip(highSkip *HighSkip) error {
	if highSkip == nil && o.HighSkipSeqno != nil {
		return mismatchError("provided HighSkipSeqno (%d) in outer link but not in inner link", o.HighSkipSeqno)
	}
	if highSkip == nil && o.HighSkipHash != nil {
		return mismatchError("provided HighSkipHash (%v) in outer link but not in inner link", o.HighSkipHash)
	}

	// o.HighSkipHash may be nil even if highSkip is not, so we don't check it
	if highSkip != nil && o.HighSkipSeqno == nil {
		return mismatchError("provided HighSkip in inner link but not HighSkipSeqno in outer link")
	}

	if highSkip == nil {
		return nil
	}

	if *o.HighSkipSeqno != highSkip.Seqno {
		return mismatchError("highSkip.Seqno field outer (%d)/inner (%d) mismatch", *o.HighSkipSeqno, highSkip.Seqno)
	}

	if o.HighSkipHash == nil && highSkip.Hash != nil {
		return mismatchError("Provided HighSkip.Hash in outer link but not inner.")
	}
	if o.HighSkipHash != nil && highSkip.Hash == nil {
		return mismatchError("Provided HighSkip.Hash in inner link but not outer.")
	}

	if o.HighSkipHash != nil && !o.HighSkipHash.Eq(highSkip.Hash) {
		return mismatchError("highSkip.Hash field outer (%v)/inner (%v) mismatch", o.HighSkipHash, highSkip.Hash)
	}

	return nil
}

func (o OuterLinkV2) AssertSomeFields(
	version SigVersion,
	seqno keybase1.Seqno,
) (err error) {
	if o.Version != version {
		return mismatchError("version field (%d != %d)", o.Version, version)
	}
	if o.Seqno != seqno {
		return mismatchError("seqno field: (%d != %d)", o.Seqno, seqno)
	}
	return nil
}

package libkb

import (
	"encoding/base64"
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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

	// teams link types
	SigchainV2TypeTeamRoot             SigchainV2Type = 33
	SigchainV2TypeTeamNewSubteam       SigchainV2Type = 34
	SigchainV2TypeTeamChangeMembership SigchainV2Type = 35
	SigchainV2TypeTeamRotateKey        SigchainV2Type = 36
	SigchainV2TypeTeamLeave            SigchainV2Type = 37
	SigchainV2TypeTeamSubteamHead      SigchainV2Type = 38
	SigchainV2TypeTeamRenameSubteam    SigchainV2Type = 39
	SigchainV2TypeTeamInvite           SigchainV2Type = 40
	SigchainV2TypeTeamRenameUpPointer  SigchainV2Type = 41
)

func (t SigchainV2Type) NeedsSignature() bool {
	switch t {
	case SigchainV2TypeTrack, SigchainV2TypeUntrack, SigchainV2TypeAnnouncement:
		return false
	default:
		return true
	}
}

func (t SigchainV2Type) IsTeamType() bool {
	switch t {
	case SigchainV2TypeTeamRoot,
		SigchainV2TypeTeamNewSubteam,
		SigchainV2TypeTeamChangeMembership,
		SigchainV2TypeTeamRotateKey,
		SigchainV2TypeTeamLeave,
		SigchainV2TypeTeamSubteamHead,
		SigchainV2TypeTeamRenameSubteam,
		SigchainV2TypeTeamInvite,
		SigchainV2TypeTeamRenameUpPointer:
		return true
	default:
		return false
	}
}

func (t SigchainV2Type) TeamAllowStubWithAdminFlag(isAdmin bool) bool {
	role := keybase1.TeamRole_READER
	if isAdmin {
		role = keybase1.TeamRole_ADMIN
	}
	return t.TeamAllowStub(role)
}

func (t SigchainV2Type) RequiresAdminPermission() bool {
	if !t.IsTeamType() {
		return false
	}
	switch t {
	case SigchainV2TypeTeamLeave, SigchainV2TypeTeamRotateKey, SigchainV2TypeTeamRoot:
		return false
	default:
		return true
	}
}

// whether the type can be stubbed for a team member with role
func (t SigchainV2Type) TeamAllowStub(role keybase1.TeamRole) bool {
	switch role {
	case keybase1.TeamRole_OWNER:
		return false
	case keybase1.TeamRole_ADMIN:
		return false
	case keybase1.TeamRole_NONE, keybase1.TeamRole_READER, keybase1.TeamRole_WRITER:
		switch t {
		case SigchainV2TypeTeamNewSubteam, SigchainV2TypeTeamRenameSubteam, SigchainV2TypeTeamInvite:
			return true
		default:
			// disallow stubbing of other including unknown links
			return false
		}
	}
	// Should never happen. Just disallow stubs.
	return false
}

// OuterLinkV2 is the second version of Keybase sigchain signatures.
type OuterLinkV2 struct {
	_struct  bool           `codec:",toarray"`
	Version  int            `codec:"version"`
	Seqno    keybase1.Seqno `codec:"seqno"`
	Prev     LinkID         `codec:"prev"`
	Curr     LinkID         `codec:"curr"`
	LinkType SigchainV2Type `codec:"type"`
}

type OuterLinkV2WithMetadata struct {
	OuterLinkV2
	raw   []byte
	sigID keybase1.SigID
	sig   string
	KID   keybase1.KID
}

func (o OuterLinkV2) Encode() ([]byte, error) {
	return MsgpackEncode(o)
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
	key, err := ImportKeypairFromKID(o.KID)
	if err != nil {
		return kid, err
	}
	_, err = key.VerifyString(ctx, o.sig, o.raw)
	if err != nil {
		return kid, err
	}
	return o.KID, nil
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
		KID:         kid,
		sig:         armored,
	}
	return &ret, nil
}

func SigchainV2TypeFromV1TypeAndRevocations(s string, hasRevocations bool) (ret SigchainV2Type, err error) {

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
	default:
		teamRes, teamErr := SigchainV2TypeFromV1TypeTeams(s)
		if teamErr == nil {
			ret = teamRes
		} else {
			ret = SigchainV2TypeNone
			err = ChainLinkError{fmt.Sprintf("Unknown sig v1 type: %s", s)}
		}
	}

	if !ret.NeedsSignature() && hasRevocations {
		err = ChainLinkError{fmt.Sprintf("invalid chain link of type %d with a revocation", ret)}
	}

	return ret, err
}

func SigchainV2TypeFromV1TypeTeams(s string) (ret SigchainV2Type, err error) {
	switch s {
	case "team.root":
		ret = SigchainV2TypeTeamRoot
	case "team.new_subteam":
		ret = SigchainV2TypeTeamNewSubteam
	case "team.change_membership":
		ret = SigchainV2TypeTeamChangeMembership
	case "team.rotate_key":
		ret = SigchainV2TypeTeamRotateKey
	case "team.leave":
		ret = SigchainV2TypeTeamLeave
	case "team.subteam_head":
		ret = SigchainV2TypeTeamSubteamHead
	case "team.rename_subteam":
		ret = SigchainV2TypeTeamRenameSubteam
	case "team.invite":
		ret = SigchainV2TypeTeamInvite
	default:
		return SigchainV2TypeNone, ChainLinkError{fmt.Sprintf("Unknown team sig v1 type: %s", s)}
	}

	return ret, err
}

func (o OuterLinkV2) AssertFields(v int, s keybase1.Seqno, p LinkID, c LinkID, t SigchainV2Type) (err error) {
	mkErr := func(format string, arg ...interface{}) error {
		return SigchainV2MismatchedFieldError{fmt.Sprintf(format, arg...)}
	}
	if o.Version != v {
		return mkErr("version field (%d != %d)", o.Version, v)
	}
	if o.Seqno != s {
		return mkErr("seqno field: (%d != %d)", o.Seqno, s)
	}
	if !o.Prev.Eq(p) {
		return mkErr("prev pointer: (%s != !%s)", o.Prev, p)
	}
	if !o.Curr.Eq(c) {
		return mkErr("curr pointer: (%s != %s)", o.Curr, c)
	}
	if o.LinkType != t {
		return mkErr("link type: (%d != %d)", o.LinkType, t)
	}
	return nil
}

func (o OuterLinkV2) AssertSomeFields(v int, s keybase1.Seqno) (err error) {
	mkErr := func(format string, arg ...interface{}) error {
		return SigchainV2MismatchedFieldError{fmt.Sprintf(format, arg...)}
	}
	if o.Version != v {
		return mkErr("version field (%d != %d)", o.Version, v)
	}
	if o.Seqno != s {
		return mkErr("seqno field: (%d != %d)", o.Seqno, s)
	}
	return nil
}

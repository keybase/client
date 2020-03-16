// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/identify_ui.avdl

package keybase1

import (
	"fmt"
)

type ProofResult struct {
	State  ProofState  `codec:"state" json:"state"`
	Status ProofStatus `codec:"status" json:"status"`
	Desc   string      `codec:"desc" json:"desc"`
}

func (o ProofResult) DeepCopy() ProofResult {
	return ProofResult{
		State:  o.State.DeepCopy(),
		Status: o.Status.DeepCopy(),
		Desc:   o.Desc,
	}
}

type IdentifyRow struct {
	RowId     int         `codec:"rowId" json:"rowId"`
	Proof     RemoteProof `codec:"proof" json:"proof"`
	TrackDiff *TrackDiff  `codec:"trackDiff,omitempty" json:"trackDiff,omitempty"`
}

func (o IdentifyRow) DeepCopy() IdentifyRow {
	return IdentifyRow{
		RowId: o.RowId,
		Proof: o.Proof.DeepCopy(),
		TrackDiff: (func(x *TrackDiff) *TrackDiff {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TrackDiff),
	}
}

type IdentifyKey struct {
	PGPFingerprint []byte     `codec:"pgpFingerprint" json:"pgpFingerprint"`
	KID            KID        `codec:"KID" json:"KID"`
	TrackDiff      *TrackDiff `codec:"trackDiff,omitempty" json:"trackDiff,omitempty"`
	BreaksTracking bool       `codec:"breaksTracking" json:"breaksTracking"`
	SigID          SigID      `codec:"sigID" json:"sigID"`
}

func (o IdentifyKey) DeepCopy() IdentifyKey {
	return IdentifyKey{
		PGPFingerprint: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.PGPFingerprint),
		KID: o.KID.DeepCopy(),
		TrackDiff: (func(x *TrackDiff) *TrackDiff {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TrackDiff),
		BreaksTracking: o.BreaksTracking,
		SigID:          o.SigID.DeepCopy(),
	}
}

type Cryptocurrency struct {
	RowId   int    `codec:"rowId" json:"rowId"`
	Pkhash  []byte `codec:"pkhash" json:"pkhash"`
	Address string `codec:"address" json:"address"`
	SigID   SigID  `codec:"sigID" json:"sigID"`
	Type    string `codec:"type" json:"type"`
	Family  string `codec:"family" json:"family"`
}

func (o Cryptocurrency) DeepCopy() Cryptocurrency {
	return Cryptocurrency{
		RowId: o.RowId,
		Pkhash: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Pkhash),
		Address: o.Address,
		SigID:   o.SigID.DeepCopy(),
		Type:    o.Type,
		Family:  o.Family,
	}
}

type StellarAccount struct {
	AccountID         string `codec:"accountID" json:"accountID"`
	FederationAddress string `codec:"federationAddress" json:"federationAddress"`
	SigID             SigID  `codec:"sigID" json:"sigID"`
	Hidden            bool   `codec:"hidden" json:"hidden"`
}

func (o StellarAccount) DeepCopy() StellarAccount {
	return StellarAccount{
		AccountID:         o.AccountID,
		FederationAddress: o.FederationAddress,
		SigID:             o.SigID.DeepCopy(),
		Hidden:            o.Hidden,
	}
}

type RevokedProof struct {
	Proof   RemoteProof `codec:"proof" json:"proof"`
	Diff    TrackDiff   `codec:"diff" json:"diff"`
	Snoozed bool        `codec:"snoozed" json:"snoozed"`
}

func (o RevokedProof) DeepCopy() RevokedProof {
	return RevokedProof{
		Proof:   o.Proof.DeepCopy(),
		Diff:    o.Diff.DeepCopy(),
		Snoozed: o.Snoozed,
	}
}

type Identity struct {
	Status          *Status          `codec:"status,omitempty" json:"status,omitempty"`
	WhenLastTracked Time             `codec:"whenLastTracked" json:"whenLastTracked"`
	Proofs          []IdentifyRow    `codec:"proofs" json:"proofs"`
	Cryptocurrency  []Cryptocurrency `codec:"cryptocurrency" json:"cryptocurrency"`
	Revoked         []TrackDiff      `codec:"revoked" json:"revoked"`
	RevokedDetails  []RevokedProof   `codec:"revokedDetails" json:"revokedDetails"`
	BreaksTracking  bool             `codec:"breaksTracking" json:"breaksTracking"`
}

func (o Identity) DeepCopy() Identity {
	return Identity{
		Status: (func(x *Status) *Status {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Status),
		WhenLastTracked: o.WhenLastTracked.DeepCopy(),
		Proofs: (func(x []IdentifyRow) []IdentifyRow {
			if x == nil {
				return nil
			}
			ret := make([]IdentifyRow, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Proofs),
		Cryptocurrency: (func(x []Cryptocurrency) []Cryptocurrency {
			if x == nil {
				return nil
			}
			ret := make([]Cryptocurrency, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Cryptocurrency),
		Revoked: (func(x []TrackDiff) []TrackDiff {
			if x == nil {
				return nil
			}
			ret := make([]TrackDiff, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Revoked),
		RevokedDetails: (func(x []RevokedProof) []RevokedProof {
			if x == nil {
				return nil
			}
			ret := make([]RevokedProof, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RevokedDetails),
		BreaksTracking: o.BreaksTracking,
	}
}

type SigHint struct {
	RemoteId  string `codec:"remoteId" json:"remoteId"`
	HumanUrl  string `codec:"humanUrl" json:"humanUrl"`
	ApiUrl    string `codec:"apiUrl" json:"apiUrl"`
	CheckText string `codec:"checkText" json:"checkText"`
}

func (o SigHint) DeepCopy() SigHint {
	return SigHint{
		RemoteId:  o.RemoteId,
		HumanUrl:  o.HumanUrl,
		ApiUrl:    o.ApiUrl,
		CheckText: o.CheckText,
	}
}

type CheckResultFreshness int

const (
	CheckResultFreshness_FRESH  CheckResultFreshness = 0
	CheckResultFreshness_AGED   CheckResultFreshness = 1
	CheckResultFreshness_RANCID CheckResultFreshness = 2
)

func (o CheckResultFreshness) DeepCopy() CheckResultFreshness { return o }

var CheckResultFreshnessMap = map[string]CheckResultFreshness{
	"FRESH":  0,
	"AGED":   1,
	"RANCID": 2,
}

var CheckResultFreshnessRevMap = map[CheckResultFreshness]string{
	0: "FRESH",
	1: "AGED",
	2: "RANCID",
}

func (e CheckResultFreshness) String() string {
	if v, ok := CheckResultFreshnessRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type CheckResult struct {
	ProofResult ProofResult          `codec:"proofResult" json:"proofResult"`
	Time        Time                 `codec:"time" json:"time"`
	Freshness   CheckResultFreshness `codec:"freshness" json:"freshness"`
}

func (o CheckResult) DeepCopy() CheckResult {
	return CheckResult{
		ProofResult: o.ProofResult.DeepCopy(),
		Time:        o.Time.DeepCopy(),
		Freshness:   o.Freshness.DeepCopy(),
	}
}

type LinkCheckResult struct {
	ProofId            int          `codec:"proofId" json:"proofId"`
	ProofResult        ProofResult  `codec:"proofResult" json:"proofResult"`
	SnoozedResult      ProofResult  `codec:"snoozedResult" json:"snoozedResult"`
	TorWarning         bool         `codec:"torWarning" json:"torWarning"`
	TmpTrackExpireTime Time         `codec:"tmpTrackExpireTime" json:"tmpTrackExpireTime"`
	Cached             *CheckResult `codec:"cached,omitempty" json:"cached,omitempty"`
	Diff               *TrackDiff   `codec:"diff,omitempty" json:"diff,omitempty"`
	RemoteDiff         *TrackDiff   `codec:"remoteDiff,omitempty" json:"remoteDiff,omitempty"`
	Hint               *SigHint     `codec:"hint,omitempty" json:"hint,omitempty"`
	BreaksTracking     bool         `codec:"breaksTracking" json:"breaksTracking"`
}

func (o LinkCheckResult) DeepCopy() LinkCheckResult {
	return LinkCheckResult{
		ProofId:            o.ProofId,
		ProofResult:        o.ProofResult.DeepCopy(),
		SnoozedResult:      o.SnoozedResult.DeepCopy(),
		TorWarning:         o.TorWarning,
		TmpTrackExpireTime: o.TmpTrackExpireTime.DeepCopy(),
		Cached: (func(x *CheckResult) *CheckResult {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Cached),
		Diff: (func(x *TrackDiff) *TrackDiff {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Diff),
		RemoteDiff: (func(x *TrackDiff) *TrackDiff {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RemoteDiff),
		Hint: (func(x *SigHint) *SigHint {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Hint),
		BreaksTracking: o.BreaksTracking,
	}
}

type UserTeamShowcase struct {
	FqName          string   `codec:"fqName" json:"fq_name"`
	Open            bool     `codec:"open" json:"open"`
	TeamIsShowcased bool     `codec:"teamIsShowcased" json:"team_is_showcased"`
	Description     string   `codec:"description" json:"description"`
	Role            TeamRole `codec:"role" json:"role"`
	PublicAdmins    []string `codec:"publicAdmins" json:"public_admins"`
	NumMembers      int      `codec:"numMembers" json:"num_members"`
}

func (o UserTeamShowcase) DeepCopy() UserTeamShowcase {
	return UserTeamShowcase{
		FqName:          o.FqName,
		Open:            o.Open,
		TeamIsShowcased: o.TeamIsShowcased,
		Description:     o.Description,
		Role:            o.Role.DeepCopy(),
		PublicAdmins: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.PublicAdmins),
		NumMembers: o.NumMembers,
	}
}

type UserCard struct {
	Following            int                `codec:"following" json:"following"`
	Followers            int                `codec:"followers" json:"followers"`
	Uid                  UID                `codec:"uid" json:"uid"`
	FullName             string             `codec:"fullName" json:"fullName"`
	Location             string             `codec:"location" json:"location"`
	Bio                  string             `codec:"bio" json:"bio"`
	BioDecorated         string             `codec:"bioDecorated" json:"bioDecorated"`
	Website              string             `codec:"website" json:"website"`
	Twitter              string             `codec:"twitter" json:"twitter"`
	YouFollowThem        bool               `codec:"youFollowThem" json:"youFollowThem"`
	TheyFollowYou        bool               `codec:"theyFollowYou" json:"theyFollowYou"`
	TeamShowcase         []UserTeamShowcase `codec:"teamShowcase" json:"teamShowcase"`
	RegisteredForAirdrop bool               `codec:"registeredForAirdrop" json:"registeredForAirdrop"`
	StellarHidden        bool               `codec:"stellarHidden" json:"stellarHidden"`
	Blocked              bool               `codec:"blocked" json:"blocked"`
	HidFromFollowers     bool               `codec:"hidFromFollowers" json:"hidFromFollowers"`
}

func (o UserCard) DeepCopy() UserCard {
	return UserCard{
		Following:     o.Following,
		Followers:     o.Followers,
		Uid:           o.Uid.DeepCopy(),
		FullName:      o.FullName,
		Location:      o.Location,
		Bio:           o.Bio,
		BioDecorated:  o.BioDecorated,
		Website:       o.Website,
		Twitter:       o.Twitter,
		YouFollowThem: o.YouFollowThem,
		TheyFollowYou: o.TheyFollowYou,
		TeamShowcase: (func(x []UserTeamShowcase) []UserTeamShowcase {
			if x == nil {
				return nil
			}
			ret := make([]UserTeamShowcase, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.TeamShowcase),
		RegisteredForAirdrop: o.RegisteredForAirdrop,
		StellarHidden:        o.StellarHidden,
		Blocked:              o.Blocked,
		HidFromFollowers:     o.HidFromFollowers,
	}
}

type ConfirmResult struct {
	IdentityConfirmed bool `codec:"identityConfirmed" json:"identityConfirmed"`
	RemoteConfirmed   bool `codec:"remoteConfirmed" json:"remoteConfirmed"`
	ExpiringLocal     bool `codec:"expiringLocal" json:"expiringLocal"`
	AutoConfirmed     bool `codec:"autoConfirmed" json:"autoConfirmed"`
}

func (o ConfirmResult) DeepCopy() ConfirmResult {
	return ConfirmResult{
		IdentityConfirmed: o.IdentityConfirmed,
		RemoteConfirmed:   o.RemoteConfirmed,
		ExpiringLocal:     o.ExpiringLocal,
		AutoConfirmed:     o.AutoConfirmed,
	}
}

type DismissReasonType int

const (
	DismissReasonType_NONE              DismissReasonType = 0
	DismissReasonType_HANDLED_ELSEWHERE DismissReasonType = 1
)

func (o DismissReasonType) DeepCopy() DismissReasonType { return o }

var DismissReasonTypeMap = map[string]DismissReasonType{
	"NONE":              0,
	"HANDLED_ELSEWHERE": 1,
}

var DismissReasonTypeRevMap = map[DismissReasonType]string{
	0: "NONE",
	1: "HANDLED_ELSEWHERE",
}

func (e DismissReasonType) String() string {
	if v, ok := DismissReasonTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type DismissReason struct {
	Type     DismissReasonType `codec:"type" json:"type"`
	Reason   string            `codec:"reason" json:"reason"`
	Resource string            `codec:"resource" json:"resource"`
}

func (o DismissReason) DeepCopy() DismissReason {
	return DismissReason{
		Type:     o.Type.DeepCopy(),
		Reason:   o.Reason,
		Resource: o.Resource,
	}
}

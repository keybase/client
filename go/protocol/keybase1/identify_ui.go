// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/identify_ui.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
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
	UnverifiedNumFollowing int                `codec:"unverifiedNumFollowing" json:"unverifiedNumFollowing"`
	UnverifiedNumFollowers int                `codec:"unverifiedNumFollowers" json:"unverifiedNumFollowers"`
	Uid                    UID                `codec:"uid" json:"uid"`
	FullName               string             `codec:"fullName" json:"fullName"`
	Location               string             `codec:"location" json:"location"`
	Bio                    string             `codec:"bio" json:"bio"`
	BioDecorated           string             `codec:"bioDecorated" json:"bioDecorated"`
	Website                string             `codec:"website" json:"website"`
	Twitter                string             `codec:"twitter" json:"twitter"`
	TeamShowcase           []UserTeamShowcase `codec:"teamShowcase" json:"teamShowcase"`
	RegisteredForAirdrop   bool               `codec:"registeredForAirdrop" json:"registeredForAirdrop"`
	StellarHidden          bool               `codec:"stellarHidden" json:"stellarHidden"`
	Blocked                bool               `codec:"blocked" json:"blocked"`
	HidFromFollowers       bool               `codec:"hidFromFollowers" json:"hidFromFollowers"`
}

func (o UserCard) DeepCopy() UserCard {
	return UserCard{
		UnverifiedNumFollowing: o.UnverifiedNumFollowing,
		UnverifiedNumFollowers: o.UnverifiedNumFollowers,
		Uid:                    o.Uid.DeepCopy(),
		FullName:               o.FullName,
		Location:               o.Location,
		Bio:                    o.Bio,
		BioDecorated:           o.BioDecorated,
		Website:                o.Website,
		Twitter:                o.Twitter,
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

type DisplayTLFCreateWithInviteArg struct {
	SessionID       int             `codec:"sessionID" json:"sessionID"`
	FolderName      string          `codec:"folderName" json:"folderName"`
	IsPrivate       bool            `codec:"isPrivate" json:"isPrivate"`
	Assertion       string          `codec:"assertion" json:"assertion"`
	SocialAssertion SocialAssertion `codec:"socialAssertion" json:"socialAssertion"`
	InviteLink      string          `codec:"inviteLink" json:"inviteLink"`
	Throttled       bool            `codec:"throttled" json:"throttled"`
}

type DelegateIdentifyUIArg struct {
}

type StartArg struct {
	SessionID    int            `codec:"sessionID" json:"sessionID"`
	Username     string         `codec:"username" json:"username"`
	Reason       IdentifyReason `codec:"reason" json:"reason"`
	ForceDisplay bool           `codec:"forceDisplay" json:"forceDisplay"`
}

type DisplayKeyArg struct {
	SessionID int         `codec:"sessionID" json:"sessionID"`
	Key       IdentifyKey `codec:"key" json:"key"`
}

type ReportLastTrackArg struct {
	SessionID int           `codec:"sessionID" json:"sessionID"`
	Track     *TrackSummary `codec:"track,omitempty" json:"track,omitempty"`
}

type LaunchNetworkChecksArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Identity  Identity `codec:"identity" json:"identity"`
	User      User     `codec:"user" json:"user"`
}

type DisplayTrackStatementArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Stmt      string `codec:"stmt" json:"stmt"`
}

type FinishWebProofCheckArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Rp        RemoteProof     `codec:"rp" json:"rp"`
	Lcr       LinkCheckResult `codec:"lcr" json:"lcr"`
}

type FinishSocialProofCheckArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Rp        RemoteProof     `codec:"rp" json:"rp"`
	Lcr       LinkCheckResult `codec:"lcr" json:"lcr"`
}

type DisplayCryptocurrencyArg struct {
	SessionID int            `codec:"sessionID" json:"sessionID"`
	C         Cryptocurrency `codec:"c" json:"c"`
}

type DisplayStellarAccountArg struct {
	SessionID int            `codec:"sessionID" json:"sessionID"`
	A         StellarAccount `codec:"a" json:"a"`
}

type ReportTrackTokenArg struct {
	SessionID  int        `codec:"sessionID" json:"sessionID"`
	TrackToken TrackToken `codec:"trackToken" json:"trackToken"`
}

type DisplayUserCardArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Card      UserCard `codec:"card" json:"card"`
}

type ConfirmArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Outcome   IdentifyOutcome `codec:"outcome" json:"outcome"`
}

type CancelArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type FinishArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DismissArg struct {
	SessionID int           `codec:"sessionID" json:"sessionID"`
	Username  string        `codec:"username" json:"username"`
	Reason    DismissReason `codec:"reason" json:"reason"`
}

type IdentifyUiInterface interface {
	DisplayTLFCreateWithInvite(context.Context, DisplayTLFCreateWithInviteArg) error
	DelegateIdentifyUI(context.Context) (int, error)
	Start(context.Context, StartArg) error
	DisplayKey(context.Context, DisplayKeyArg) error
	ReportLastTrack(context.Context, ReportLastTrackArg) error
	LaunchNetworkChecks(context.Context, LaunchNetworkChecksArg) error
	DisplayTrackStatement(context.Context, DisplayTrackStatementArg) error
	FinishWebProofCheck(context.Context, FinishWebProofCheckArg) error
	FinishSocialProofCheck(context.Context, FinishSocialProofCheckArg) error
	DisplayCryptocurrency(context.Context, DisplayCryptocurrencyArg) error
	DisplayStellarAccount(context.Context, DisplayStellarAccountArg) error
	ReportTrackToken(context.Context, ReportTrackTokenArg) error
	DisplayUserCard(context.Context, DisplayUserCardArg) error
	Confirm(context.Context, ConfirmArg) (ConfirmResult, error)
	Cancel(context.Context, int) error
	Finish(context.Context, int) error
	Dismiss(context.Context, DismissArg) error
}

func IdentifyUiProtocol(i IdentifyUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.identifyUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"displayTLFCreateWithInvite": {
				MakeArg: func() interface{} {
					var ret [1]DisplayTLFCreateWithInviteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DisplayTLFCreateWithInviteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DisplayTLFCreateWithInviteArg)(nil), args)
						return
					}
					err = i.DisplayTLFCreateWithInvite(ctx, typedArgs[0])
					return
				},
			},
			"delegateIdentifyUI": {
				MakeArg: func() interface{} {
					var ret [1]DelegateIdentifyUIArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.DelegateIdentifyUI(ctx)
					return
				},
			},
			"start": {
				MakeArg: func() interface{} {
					var ret [1]StartArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]StartArg)
					if !ok {
						err = rpc.NewTypeError((*[1]StartArg)(nil), args)
						return
					}
					err = i.Start(ctx, typedArgs[0])
					return
				},
			},
			"displayKey": {
				MakeArg: func() interface{} {
					var ret [1]DisplayKeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DisplayKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DisplayKeyArg)(nil), args)
						return
					}
					err = i.DisplayKey(ctx, typedArgs[0])
					return
				},
			},
			"reportLastTrack": {
				MakeArg: func() interface{} {
					var ret [1]ReportLastTrackArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ReportLastTrackArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ReportLastTrackArg)(nil), args)
						return
					}
					err = i.ReportLastTrack(ctx, typedArgs[0])
					return
				},
			},
			"launchNetworkChecks": {
				MakeArg: func() interface{} {
					var ret [1]LaunchNetworkChecksArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LaunchNetworkChecksArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LaunchNetworkChecksArg)(nil), args)
						return
					}
					err = i.LaunchNetworkChecks(ctx, typedArgs[0])
					return
				},
			},
			"displayTrackStatement": {
				MakeArg: func() interface{} {
					var ret [1]DisplayTrackStatementArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DisplayTrackStatementArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DisplayTrackStatementArg)(nil), args)
						return
					}
					err = i.DisplayTrackStatement(ctx, typedArgs[0])
					return
				},
			},
			"finishWebProofCheck": {
				MakeArg: func() interface{} {
					var ret [1]FinishWebProofCheckArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FinishWebProofCheckArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FinishWebProofCheckArg)(nil), args)
						return
					}
					err = i.FinishWebProofCheck(ctx, typedArgs[0])
					return
				},
			},
			"finishSocialProofCheck": {
				MakeArg: func() interface{} {
					var ret [1]FinishSocialProofCheckArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FinishSocialProofCheckArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FinishSocialProofCheckArg)(nil), args)
						return
					}
					err = i.FinishSocialProofCheck(ctx, typedArgs[0])
					return
				},
			},
			"displayCryptocurrency": {
				MakeArg: func() interface{} {
					var ret [1]DisplayCryptocurrencyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DisplayCryptocurrencyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DisplayCryptocurrencyArg)(nil), args)
						return
					}
					err = i.DisplayCryptocurrency(ctx, typedArgs[0])
					return
				},
			},
			"displayStellarAccount": {
				MakeArg: func() interface{} {
					var ret [1]DisplayStellarAccountArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DisplayStellarAccountArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DisplayStellarAccountArg)(nil), args)
						return
					}
					err = i.DisplayStellarAccount(ctx, typedArgs[0])
					return
				},
			},
			"reportTrackToken": {
				MakeArg: func() interface{} {
					var ret [1]ReportTrackTokenArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ReportTrackTokenArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ReportTrackTokenArg)(nil), args)
						return
					}
					err = i.ReportTrackToken(ctx, typedArgs[0])
					return
				},
			},
			"displayUserCard": {
				MakeArg: func() interface{} {
					var ret [1]DisplayUserCardArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DisplayUserCardArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DisplayUserCardArg)(nil), args)
						return
					}
					err = i.DisplayUserCard(ctx, typedArgs[0])
					return
				},
			},
			"confirm": {
				MakeArg: func() interface{} {
					var ret [1]ConfirmArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ConfirmArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ConfirmArg)(nil), args)
						return
					}
					ret, err = i.Confirm(ctx, typedArgs[0])
					return
				},
			},
			"cancel": {
				MakeArg: func() interface{} {
					var ret [1]CancelArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CancelArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CancelArg)(nil), args)
						return
					}
					err = i.Cancel(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"finish": {
				MakeArg: func() interface{} {
					var ret [1]FinishArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FinishArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FinishArg)(nil), args)
						return
					}
					err = i.Finish(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"dismiss": {
				MakeArg: func() interface{} {
					var ret [1]DismissArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DismissArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DismissArg)(nil), args)
						return
					}
					err = i.Dismiss(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type IdentifyUiClient struct {
	Cli rpc.GenericClient
}

func (c IdentifyUiClient) DisplayTLFCreateWithInvite(ctx context.Context, __arg DisplayTLFCreateWithInviteArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.displayTLFCreateWithInvite", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) DelegateIdentifyUI(ctx context.Context) (res int, err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.delegateIdentifyUI", []interface{}{DelegateIdentifyUIArg{}}, &res, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) Start(ctx context.Context, __arg StartArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.start", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) DisplayKey(ctx context.Context, __arg DisplayKeyArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.displayKey", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) ReportLastTrack(ctx context.Context, __arg ReportLastTrackArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.reportLastTrack", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) LaunchNetworkChecks(ctx context.Context, __arg LaunchNetworkChecksArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.launchNetworkChecks", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) DisplayTrackStatement(ctx context.Context, __arg DisplayTrackStatementArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.displayTrackStatement", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) FinishWebProofCheck(ctx context.Context, __arg FinishWebProofCheckArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.finishWebProofCheck", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) FinishSocialProofCheck(ctx context.Context, __arg FinishSocialProofCheckArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.finishSocialProofCheck", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) DisplayCryptocurrency(ctx context.Context, __arg DisplayCryptocurrencyArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.displayCryptocurrency", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) DisplayStellarAccount(ctx context.Context, __arg DisplayStellarAccountArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.displayStellarAccount", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) ReportTrackToken(ctx context.Context, __arg ReportTrackTokenArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.reportTrackToken", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) DisplayUserCard(ctx context.Context, __arg DisplayUserCardArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.displayUserCard", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) Confirm(ctx context.Context, __arg ConfirmArg) (res ConfirmResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.confirm", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) Cancel(ctx context.Context, sessionID int) (err error) {
	__arg := CancelArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.cancel", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) Finish(ctx context.Context, sessionID int) (err error) {
	__arg := FinishArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.finish", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c IdentifyUiClient) Dismiss(ctx context.Context, __arg DismissArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.dismiss", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

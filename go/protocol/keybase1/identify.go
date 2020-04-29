// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/identify.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type IdentifyProofBreak struct {
	RemoteProof RemoteProof     `codec:"remoteProof" json:"remoteProof"`
	Lcr         LinkCheckResult `codec:"lcr" json:"lcr"`
}

func (o IdentifyProofBreak) DeepCopy() IdentifyProofBreak {
	return IdentifyProofBreak{
		RemoteProof: o.RemoteProof.DeepCopy(),
		Lcr:         o.Lcr.DeepCopy(),
	}
}

type IdentifyTrackBreaks struct {
	Keys   []IdentifyKey        `codec:"keys" json:"keys"`
	Proofs []IdentifyProofBreak `codec:"proofs" json:"proofs"`
}

func (o IdentifyTrackBreaks) DeepCopy() IdentifyTrackBreaks {
	return IdentifyTrackBreaks{
		Keys: (func(x []IdentifyKey) []IdentifyKey {
			if x == nil {
				return nil
			}
			ret := make([]IdentifyKey, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Keys),
		Proofs: (func(x []IdentifyProofBreak) []IdentifyProofBreak {
			if x == nil {
				return nil
			}
			ret := make([]IdentifyProofBreak, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Proofs),
	}
}

type Identify2Res struct {
	Upk          UserPlusKeys         `codec:"upk" json:"upk"`
	IdentifiedAt Time                 `codec:"identifiedAt" json:"identifiedAt"`
	TrackBreaks  *IdentifyTrackBreaks `codec:"trackBreaks,omitempty" json:"trackBreaks,omitempty"`
}

func (o Identify2Res) DeepCopy() Identify2Res {
	return Identify2Res{
		Upk:          o.Upk.DeepCopy(),
		IdentifiedAt: o.IdentifiedAt.DeepCopy(),
		TrackBreaks: (func(x *IdentifyTrackBreaks) *IdentifyTrackBreaks {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TrackBreaks),
	}
}

type Identify2ResUPK2 struct {
	Upk          UserPlusKeysV2AllIncarnations `codec:"upk" json:"upk"`
	IdentifiedAt Time                          `codec:"identifiedAt" json:"identifiedAt"`
	TrackBreaks  *IdentifyTrackBreaks          `codec:"trackBreaks,omitempty" json:"trackBreaks,omitempty"`
}

func (o Identify2ResUPK2) DeepCopy() Identify2ResUPK2 {
	return Identify2ResUPK2{
		Upk:          o.Upk.DeepCopy(),
		IdentifiedAt: o.IdentifiedAt.DeepCopy(),
		TrackBreaks: (func(x *IdentifyTrackBreaks) *IdentifyTrackBreaks {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TrackBreaks),
	}
}

type IdentifyLiteRes struct {
	Ul          UserOrTeamLite       `codec:"ul" json:"ul"`
	TrackBreaks *IdentifyTrackBreaks `codec:"trackBreaks,omitempty" json:"trackBreaks,omitempty"`
}

func (o IdentifyLiteRes) DeepCopy() IdentifyLiteRes {
	return IdentifyLiteRes{
		Ul: o.Ul.DeepCopy(),
		TrackBreaks: (func(x *IdentifyTrackBreaks) *IdentifyTrackBreaks {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TrackBreaks),
	}
}

type ResolveIdentifyImplicitTeamRes struct {
	DisplayName string                              `codec:"displayName" json:"displayName"`
	TeamID      TeamID                              `codec:"teamID" json:"teamID"`
	Writers     []UserVersion                       `codec:"writers" json:"writers"`
	TrackBreaks map[UserVersion]IdentifyTrackBreaks `codec:"trackBreaks" json:"trackBreaks"`
	FolderID    TLFID                               `codec:"folderID" json:"folderID"`
}

func (o ResolveIdentifyImplicitTeamRes) DeepCopy() ResolveIdentifyImplicitTeamRes {
	return ResolveIdentifyImplicitTeamRes{
		DisplayName: o.DisplayName,
		TeamID:      o.TeamID.DeepCopy(),
		Writers: (func(x []UserVersion) []UserVersion {
			if x == nil {
				return nil
			}
			ret := make([]UserVersion, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Writers),
		TrackBreaks: (func(x map[UserVersion]IdentifyTrackBreaks) map[UserVersion]IdentifyTrackBreaks {
			if x == nil {
				return nil
			}
			ret := make(map[UserVersion]IdentifyTrackBreaks, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.TrackBreaks),
		FolderID: o.FolderID.DeepCopy(),
	}
}

type Resolve3Arg struct {
	Assertion string              `codec:"assertion" json:"assertion"`
	Oa        OfflineAvailability `codec:"oa" json:"oa"`
}

type Identify2Arg struct {
	SessionID             int                 `codec:"sessionID" json:"sessionID"`
	Uid                   UID                 `codec:"uid" json:"uid"`
	UserAssertion         string              `codec:"userAssertion" json:"userAssertion"`
	Reason                IdentifyReason      `codec:"reason" json:"reason"`
	UseDelegateUI         bool                `codec:"useDelegateUI" json:"useDelegateUI"`
	AlwaysBlock           bool                `codec:"alwaysBlock" json:"alwaysBlock"`
	NoErrorOnTrackFailure bool                `codec:"noErrorOnTrackFailure" json:"noErrorOnTrackFailure"`
	ForceRemoteCheck      bool                `codec:"forceRemoteCheck" json:"forceRemoteCheck"`
	NeedProofSet          bool                `codec:"needProofSet" json:"needProofSet"`
	AllowEmptySelfID      bool                `codec:"allowEmptySelfID" json:"allowEmptySelfID"`
	NoSkipSelf            bool                `codec:"noSkipSelf" json:"noSkipSelf"`
	CanSuppressUI         bool                `codec:"canSuppressUI" json:"canSuppressUI"`
	IdentifyBehavior      TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
	ForceDisplay          bool                `codec:"forceDisplay" json:"forceDisplay"`
	ActLoggedOut          bool                `codec:"actLoggedOut" json:"actLoggedOut"`
}

type IdentifyLiteArg struct {
	SessionID             int                 `codec:"sessionID" json:"sessionID"`
	Id                    UserOrTeamID        `codec:"id" json:"id"`
	Assertion             string              `codec:"assertion" json:"assertion"`
	Reason                IdentifyReason      `codec:"reason" json:"reason"`
	UseDelegateUI         bool                `codec:"useDelegateUI" json:"useDelegateUI"`
	AlwaysBlock           bool                `codec:"alwaysBlock" json:"alwaysBlock"`
	NoErrorOnTrackFailure bool                `codec:"noErrorOnTrackFailure" json:"noErrorOnTrackFailure"`
	ForceRemoteCheck      bool                `codec:"forceRemoteCheck" json:"forceRemoteCheck"`
	NeedProofSet          bool                `codec:"needProofSet" json:"needProofSet"`
	AllowEmptySelfID      bool                `codec:"allowEmptySelfID" json:"allowEmptySelfID"`
	NoSkipSelf            bool                `codec:"noSkipSelf" json:"noSkipSelf"`
	CanSuppressUI         bool                `codec:"canSuppressUI" json:"canSuppressUI"`
	IdentifyBehavior      TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
	ForceDisplay          bool                `codec:"forceDisplay" json:"forceDisplay"`
	Oa                    OfflineAvailability `codec:"oa" json:"oa"`
}

type ResolveIdentifyImplicitTeamArg struct {
	SessionID        int                 `codec:"sessionID" json:"sessionID"`
	Assertions       string              `codec:"assertions" json:"assertions"`
	Suffix           string              `codec:"suffix" json:"suffix"`
	IsPublic         bool                `codec:"isPublic" json:"isPublic"`
	DoIdentifies     bool                `codec:"doIdentifies" json:"doIdentifies"`
	Create           bool                `codec:"create" json:"create"`
	Reason           IdentifyReason      `codec:"reason" json:"reason"`
	IdentifyBehavior TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
	Oa               OfflineAvailability `codec:"oa" json:"oa"`
}

type ResolveImplicitTeamArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Id        TeamID `codec:"id" json:"id"`
}

type NormalizeSocialAssertionArg struct {
	Assertion string `codec:"assertion" json:"assertion"`
}

type IdentifyInterface interface {
	// Resolve an assertion to a (UID,username) or (TeamID,teamname). On failure, returns an error.
	Resolve3(context.Context, Resolve3Arg) (UserOrTeamLite, error)
	Identify2(context.Context, Identify2Arg) (Identify2Res, error)
	IdentifyLite(context.Context, IdentifyLiteArg) (IdentifyLiteRes, error)
	ResolveIdentifyImplicitTeam(context.Context, ResolveIdentifyImplicitTeamArg) (ResolveIdentifyImplicitTeamRes, error)
	// resolveImplicitTeam returns a TLF display name given a teamID. The publicness
	// of the team is inferred from the TeamID.
	ResolveImplicitTeam(context.Context, ResolveImplicitTeamArg) (Folder, error)
	NormalizeSocialAssertion(context.Context, string) (SocialAssertion, error)
}

func IdentifyProtocol(i IdentifyInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.identify",
		Methods: map[string]rpc.ServeHandlerDescription{
			"Resolve3": {
				MakeArg: func() interface{} {
					var ret [1]Resolve3Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Resolve3Arg)
					if !ok {
						err = rpc.NewTypeError((*[1]Resolve3Arg)(nil), args)
						return
					}
					ret, err = i.Resolve3(ctx, typedArgs[0])
					return
				},
			},
			"identify2": {
				MakeArg: func() interface{} {
					var ret [1]Identify2Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Identify2Arg)
					if !ok {
						err = rpc.NewTypeError((*[1]Identify2Arg)(nil), args)
						return
					}
					ret, err = i.Identify2(ctx, typedArgs[0])
					return
				},
			},
			"identifyLite": {
				MakeArg: func() interface{} {
					var ret [1]IdentifyLiteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]IdentifyLiteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]IdentifyLiteArg)(nil), args)
						return
					}
					ret, err = i.IdentifyLite(ctx, typedArgs[0])
					return
				},
			},
			"resolveIdentifyImplicitTeam": {
				MakeArg: func() interface{} {
					var ret [1]ResolveIdentifyImplicitTeamArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ResolveIdentifyImplicitTeamArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ResolveIdentifyImplicitTeamArg)(nil), args)
						return
					}
					ret, err = i.ResolveIdentifyImplicitTeam(ctx, typedArgs[0])
					return
				},
			},
			"resolveImplicitTeam": {
				MakeArg: func() interface{} {
					var ret [1]ResolveImplicitTeamArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ResolveImplicitTeamArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ResolveImplicitTeamArg)(nil), args)
						return
					}
					ret, err = i.ResolveImplicitTeam(ctx, typedArgs[0])
					return
				},
			},
			"normalizeSocialAssertion": {
				MakeArg: func() interface{} {
					var ret [1]NormalizeSocialAssertionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]NormalizeSocialAssertionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]NormalizeSocialAssertionArg)(nil), args)
						return
					}
					ret, err = i.NormalizeSocialAssertion(ctx, typedArgs[0].Assertion)
					return
				},
			},
		},
	}
}

type IdentifyClient struct {
	Cli rpc.GenericClient
}

// Resolve an assertion to a (UID,username) or (TeamID,teamname). On failure, returns an error.
func (c IdentifyClient) Resolve3(ctx context.Context, __arg Resolve3Arg) (res UserOrTeamLite, err error) {
	err = c.Cli.Call(ctx, "keybase.1.identify.Resolve3", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c IdentifyClient) Identify2(ctx context.Context, __arg Identify2Arg) (res Identify2Res, err error) {
	err = c.Cli.Call(ctx, "keybase.1.identify.identify2", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c IdentifyClient) IdentifyLite(ctx context.Context, __arg IdentifyLiteArg) (res IdentifyLiteRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.identify.identifyLite", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c IdentifyClient) ResolveIdentifyImplicitTeam(ctx context.Context, __arg ResolveIdentifyImplicitTeamArg) (res ResolveIdentifyImplicitTeamRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.identify.resolveIdentifyImplicitTeam", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// resolveImplicitTeam returns a TLF display name given a teamID. The publicness
// of the team is inferred from the TeamID.
func (c IdentifyClient) ResolveImplicitTeam(ctx context.Context, __arg ResolveImplicitTeamArg) (res Folder, err error) {
	err = c.Cli.Call(ctx, "keybase.1.identify.resolveImplicitTeam", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c IdentifyClient) NormalizeSocialAssertion(ctx context.Context, assertion string) (res SocialAssertion, err error) {
	__arg := NormalizeSocialAssertionArg{Assertion: assertion}
	err = c.Cli.Call(ctx, "keybase.1.identify.normalizeSocialAssertion", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

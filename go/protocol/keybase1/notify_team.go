// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_team.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type TeamChangeSet struct {
	MembershipChanged bool `codec:"membershipChanged" json:"membershipChanged"`
	KeyRotated        bool `codec:"keyRotated" json:"keyRotated"`
	Renamed           bool `codec:"renamed" json:"renamed"`
	Misc              bool `codec:"misc" json:"misc"`
}

func (o TeamChangeSet) DeepCopy() TeamChangeSet {
	return TeamChangeSet{
		MembershipChanged: o.MembershipChanged,
		KeyRotated:        o.KeyRotated,
		Renamed:           o.Renamed,
		Misc:              o.Misc,
	}
}

type TeamChangedSource int

const (
	TeamChangedSource_SERVER       TeamChangedSource = 0
	TeamChangedSource_LOCAL        TeamChangedSource = 1
	TeamChangedSource_LOCAL_RENAME TeamChangedSource = 2
)

func (o TeamChangedSource) DeepCopy() TeamChangedSource { return o }

var TeamChangedSourceMap = map[string]TeamChangedSource{
	"SERVER":       0,
	"LOCAL":        1,
	"LOCAL_RENAME": 2,
}

var TeamChangedSourceRevMap = map[TeamChangedSource]string{
	0: "SERVER",
	1: "LOCAL",
	2: "LOCAL_RENAME",
}

func (e TeamChangedSource) String() string {
	if v, ok := TeamChangedSourceRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type AvatarUpdateType int

const (
	AvatarUpdateType_NONE AvatarUpdateType = 0
	AvatarUpdateType_USER AvatarUpdateType = 1
	AvatarUpdateType_TEAM AvatarUpdateType = 2
)

func (o AvatarUpdateType) DeepCopy() AvatarUpdateType { return o }

var AvatarUpdateTypeMap = map[string]AvatarUpdateType{
	"NONE": 0,
	"USER": 1,
	"TEAM": 2,
}

var AvatarUpdateTypeRevMap = map[AvatarUpdateType]string{
	0: "NONE",
	1: "USER",
	2: "TEAM",
}

func (e AvatarUpdateType) String() string {
	if v, ok := AvatarUpdateTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type TeamChangedByIDArg struct {
	TeamID              TeamID            `codec:"teamID" json:"teamID"`
	LatestSeqno         Seqno             `codec:"latestSeqno" json:"latestSeqno"`
	ImplicitTeam        bool              `codec:"implicitTeam" json:"implicitTeam"`
	Changes             TeamChangeSet     `codec:"changes" json:"changes"`
	LatestHiddenSeqno   Seqno             `codec:"latestHiddenSeqno" json:"latestHiddenSeqno"`
	LatestOffchainSeqno Seqno             `codec:"latestOffchainSeqno" json:"latestOffchainSeqno"`
	Source              TeamChangedSource `codec:"source" json:"source"`
}

type TeamChangedByNameArg struct {
	TeamName            string            `codec:"teamName" json:"teamName"`
	LatestSeqno         Seqno             `codec:"latestSeqno" json:"latestSeqno"`
	ImplicitTeam        bool              `codec:"implicitTeam" json:"implicitTeam"`
	Changes             TeamChangeSet     `codec:"changes" json:"changes"`
	LatestHiddenSeqno   Seqno             `codec:"latestHiddenSeqno" json:"latestHiddenSeqno"`
	LatestOffchainSeqno Seqno             `codec:"latestOffchainSeqno" json:"latestOffchainSeqno"`
	Source              TeamChangedSource `codec:"source" json:"source"`
}

type TeamDeletedArg struct {
	TeamID TeamID `codec:"teamID" json:"teamID"`
}

type TeamAbandonedArg struct {
	TeamID TeamID `codec:"teamID" json:"teamID"`
}

type TeamExitArg struct {
	TeamID TeamID `codec:"teamID" json:"teamID"`
}

type NewlyAddedToTeamArg struct {
	TeamID TeamID `codec:"teamID" json:"teamID"`
}

type TeamRoleMapChangedArg struct {
	NewVersion UserTeamVersion `codec:"newVersion" json:"newVersion"`
}

type AvatarUpdatedArg struct {
	Name    string           `codec:"name" json:"name"`
	Formats []AvatarFormat   `codec:"formats" json:"formats"`
	Typ     AvatarUpdateType `codec:"typ" json:"typ"`
}

type TeamMetadataUpdateArg struct {
}

type TeamTreeMembershipsPartialArg struct {
	Membership TeamTreeMembership `codec:"membership" json:"membership"`
}

type TeamTreeMembershipsDoneArg struct {
	Result TeamTreeMembershipsDoneResult `codec:"result" json:"result"`
}

type NotifyTeamInterface interface {
	TeamChangedByID(context.Context, TeamChangedByIDArg) error
	TeamChangedByName(context.Context, TeamChangedByNameArg) error
	TeamDeleted(context.Context, TeamID) error
	TeamAbandoned(context.Context, TeamID) error
	TeamExit(context.Context, TeamID) error
	NewlyAddedToTeam(context.Context, TeamID) error
	TeamRoleMapChanged(context.Context, UserTeamVersion) error
	AvatarUpdated(context.Context, AvatarUpdatedArg) error
	TeamMetadataUpdate(context.Context) error
	TeamTreeMembershipsPartial(context.Context, TeamTreeMembership) error
	TeamTreeMembershipsDone(context.Context, TeamTreeMembershipsDoneResult) error
}

func NotifyTeamProtocol(i NotifyTeamInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyTeam",
		Methods: map[string]rpc.ServeHandlerDescription{
			"teamChangedByID": {
				MakeArg: func() interface{} {
					var ret [1]TeamChangedByIDArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TeamChangedByIDArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TeamChangedByIDArg)(nil), args)
						return
					}
					err = i.TeamChangedByID(ctx, typedArgs[0])
					return
				},
			},
			"teamChangedByName": {
				MakeArg: func() interface{} {
					var ret [1]TeamChangedByNameArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TeamChangedByNameArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TeamChangedByNameArg)(nil), args)
						return
					}
					err = i.TeamChangedByName(ctx, typedArgs[0])
					return
				},
			},
			"teamDeleted": {
				MakeArg: func() interface{} {
					var ret [1]TeamDeletedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TeamDeletedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TeamDeletedArg)(nil), args)
						return
					}
					err = i.TeamDeleted(ctx, typedArgs[0].TeamID)
					return
				},
			},
			"teamAbandoned": {
				MakeArg: func() interface{} {
					var ret [1]TeamAbandonedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TeamAbandonedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TeamAbandonedArg)(nil), args)
						return
					}
					err = i.TeamAbandoned(ctx, typedArgs[0].TeamID)
					return
				},
			},
			"teamExit": {
				MakeArg: func() interface{} {
					var ret [1]TeamExitArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TeamExitArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TeamExitArg)(nil), args)
						return
					}
					err = i.TeamExit(ctx, typedArgs[0].TeamID)
					return
				},
			},
			"newlyAddedToTeam": {
				MakeArg: func() interface{} {
					var ret [1]NewlyAddedToTeamArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]NewlyAddedToTeamArg)
					if !ok {
						err = rpc.NewTypeError((*[1]NewlyAddedToTeamArg)(nil), args)
						return
					}
					err = i.NewlyAddedToTeam(ctx, typedArgs[0].TeamID)
					return
				},
			},
			"teamRoleMapChanged": {
				MakeArg: func() interface{} {
					var ret [1]TeamRoleMapChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TeamRoleMapChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TeamRoleMapChangedArg)(nil), args)
						return
					}
					err = i.TeamRoleMapChanged(ctx, typedArgs[0].NewVersion)
					return
				},
			},
			"avatarUpdated": {
				MakeArg: func() interface{} {
					var ret [1]AvatarUpdatedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AvatarUpdatedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AvatarUpdatedArg)(nil), args)
						return
					}
					err = i.AvatarUpdated(ctx, typedArgs[0])
					return
				},
			},
			"teamMetadataUpdate": {
				MakeArg: func() interface{} {
					var ret [1]TeamMetadataUpdateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.TeamMetadataUpdate(ctx)
					return
				},
			},
			"teamTreeMembershipsPartial": {
				MakeArg: func() interface{} {
					var ret [1]TeamTreeMembershipsPartialArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TeamTreeMembershipsPartialArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TeamTreeMembershipsPartialArg)(nil), args)
						return
					}
					err = i.TeamTreeMembershipsPartial(ctx, typedArgs[0].Membership)
					return
				},
			},
			"teamTreeMembershipsDone": {
				MakeArg: func() interface{} {
					var ret [1]TeamTreeMembershipsDoneArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TeamTreeMembershipsDoneArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TeamTreeMembershipsDoneArg)(nil), args)
						return
					}
					err = i.TeamTreeMembershipsDone(ctx, typedArgs[0].Result)
					return
				},
			},
		},
	}
}

type NotifyTeamClient struct {
	Cli rpc.GenericClient
}

func (c NotifyTeamClient) TeamChangedByID(ctx context.Context, __arg TeamChangedByIDArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTeam.teamChangedByID", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyTeamClient) TeamChangedByName(ctx context.Context, __arg TeamChangedByNameArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTeam.teamChangedByName", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyTeamClient) TeamDeleted(ctx context.Context, teamID TeamID) (err error) {
	__arg := TeamDeletedArg{TeamID: teamID}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTeam.teamDeleted", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyTeamClient) TeamAbandoned(ctx context.Context, teamID TeamID) (err error) {
	__arg := TeamAbandonedArg{TeamID: teamID}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTeam.teamAbandoned", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyTeamClient) TeamExit(ctx context.Context, teamID TeamID) (err error) {
	__arg := TeamExitArg{TeamID: teamID}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTeam.teamExit", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyTeamClient) NewlyAddedToTeam(ctx context.Context, teamID TeamID) (err error) {
	__arg := NewlyAddedToTeamArg{TeamID: teamID}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTeam.newlyAddedToTeam", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyTeamClient) TeamRoleMapChanged(ctx context.Context, newVersion UserTeamVersion) (err error) {
	__arg := TeamRoleMapChangedArg{NewVersion: newVersion}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTeam.teamRoleMapChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyTeamClient) AvatarUpdated(ctx context.Context, __arg AvatarUpdatedArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTeam.avatarUpdated", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyTeamClient) TeamMetadataUpdate(ctx context.Context) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTeam.teamMetadataUpdate", []interface{}{TeamMetadataUpdateArg{}}, 0*time.Millisecond)
	return
}

func (c NotifyTeamClient) TeamTreeMembershipsPartial(ctx context.Context, membership TeamTreeMembership) (err error) {
	__arg := TeamTreeMembershipsPartialArg{Membership: membership}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTeam.teamTreeMembershipsPartial", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyTeamClient) TeamTreeMembershipsDone(ctx context.Context, result TeamTreeMembershipsDoneResult) (err error) {
	__arg := TeamTreeMembershipsDoneArg{Result: result}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTeam.teamTreeMembershipsDone", []interface{}{__arg}, 0*time.Millisecond)
	return
}

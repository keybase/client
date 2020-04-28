// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/teams_ui.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type ConfirmRootTeamDeleteArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	TeamName  string `codec:"teamName" json:"teamName"`
}

type ConfirmSubteamDeleteArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	TeamName  string `codec:"teamName" json:"teamName"`
}

type ConfirmInviteLinkAcceptArg struct {
	SessionID int               `codec:"sessionID" json:"sessionID"`
	Details   InviteLinkDetails `codec:"details" json:"details"`
}

type TeamsUiInterface interface {
	ConfirmRootTeamDelete(context.Context, ConfirmRootTeamDeleteArg) (bool, error)
	ConfirmSubteamDelete(context.Context, ConfirmSubteamDeleteArg) (bool, error)
	ConfirmInviteLinkAccept(context.Context, ConfirmInviteLinkAcceptArg) (bool, error)
}

func TeamsUiProtocol(i TeamsUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.teamsUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"confirmRootTeamDelete": {
				MakeArg: func() interface{} {
					var ret [1]ConfirmRootTeamDeleteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ConfirmRootTeamDeleteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ConfirmRootTeamDeleteArg)(nil), args)
						return
					}
					ret, err = i.ConfirmRootTeamDelete(ctx, typedArgs[0])
					return
				},
			},
			"confirmSubteamDelete": {
				MakeArg: func() interface{} {
					var ret [1]ConfirmSubteamDeleteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ConfirmSubteamDeleteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ConfirmSubteamDeleteArg)(nil), args)
						return
					}
					ret, err = i.ConfirmSubteamDelete(ctx, typedArgs[0])
					return
				},
			},
			"confirmInviteLinkAccept": {
				MakeArg: func() interface{} {
					var ret [1]ConfirmInviteLinkAcceptArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ConfirmInviteLinkAcceptArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ConfirmInviteLinkAcceptArg)(nil), args)
						return
					}
					ret, err = i.ConfirmInviteLinkAccept(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type TeamsUiClient struct {
	Cli rpc.GenericClient
}

func (c TeamsUiClient) ConfirmRootTeamDelete(ctx context.Context, __arg ConfirmRootTeamDeleteArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.teamsUi.confirmRootTeamDelete", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c TeamsUiClient) ConfirmSubteamDelete(ctx context.Context, __arg ConfirmSubteamDeleteArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.teamsUi.confirmSubteamDelete", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c TeamsUiClient) ConfirmInviteLinkAccept(ctx context.Context, __arg ConfirmInviteLinkAcceptArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.teamsUi.confirmInviteLinkAccept", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

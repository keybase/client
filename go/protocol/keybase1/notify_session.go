// Code generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler). DO NOT EDIT.
//   Input file: avdl/keybase1/notify_session.avdl

package keybase1

import (
	"context"
	"time"

	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type LoggedOutArg struct {
	Version StateVersion `codec:"version" json:"version"`
}

type LoggedInArg struct {
	Username string       `codec:"username" json:"username"`
	SignedUp bool         `codec:"signedUp" json:"signedUp"`
	Version  StateVersion `codec:"version" json:"version"`
}

type ClientOutOfDateArg struct {
	UpgradeTo  string `codec:"upgradeTo" json:"upgradeTo"`
	UpgradeURI string `codec:"upgradeURI" json:"upgradeURI"`
	UpgradeMsg string `codec:"upgradeMsg" json:"upgradeMsg"`
}

type NotifySessionInterface interface {
	LoggedOut(context.Context, StateVersion) error
	LoggedIn(context.Context, LoggedInArg) error
	ClientOutOfDate(context.Context, ClientOutOfDateArg) error
}

func NotifySessionProtocol(i NotifySessionInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifySession",
		Methods: map[string]rpc.ServeHandlerDescription{
			"loggedOut": {
				MakeArg: func() any {
					var ret [1]LoggedOutArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]LoggedOutArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoggedOutArg)(nil), args)
						return
					}
					err = i.LoggedOut(ctx, typedArgs[0].Version)
					return
				},
			},
			"loggedIn": {
				MakeArg: func() any {
					var ret [1]LoggedInArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]LoggedInArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoggedInArg)(nil), args)
						return
					}
					err = i.LoggedIn(ctx, typedArgs[0])
					return
				},
			},
			"clientOutOfDate": {
				MakeArg: func() any {
					var ret [1]ClientOutOfDateArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]ClientOutOfDateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ClientOutOfDateArg)(nil), args)
						return
					}
					err = i.ClientOutOfDate(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type NotifySessionClient struct {
	Cli rpc.GenericClient
}

func (c NotifySessionClient) LoggedOut(ctx context.Context, version StateVersion) (err error) {
	__arg := LoggedOutArg{Version: version}
	err = c.Cli.Notify(ctx, "keybase.1.NotifySession.loggedOut", []any{__arg}, 0*time.Millisecond)
	return
}

func (c NotifySessionClient) LoggedIn(ctx context.Context, __arg LoggedInArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.NotifySession.loggedIn", []any{__arg}, nil, 0*time.Millisecond)
	return
}

func (c NotifySessionClient) ClientOutOfDate(ctx context.Context, __arg ClientOutOfDateArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.NotifySession.clientOutOfDate", []any{__arg}, nil, 0*time.Millisecond)
	return
}

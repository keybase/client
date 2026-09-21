// Code generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler). DO NOT EDIT.
//   Input file: avdl/keybase1/notify_app.avdl

package keybase1

import (
	"context"
	"time"

	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type ExitArg struct {
}

type MobileAppStateChangedArg struct {
	State MobileAppState `codec:"state" json:"state"`
}

type NotifyAppInterface interface {
	Exit(context.Context) error
	MobileAppStateChanged(context.Context, MobileAppState) error
}

func NotifyAppProtocol(i NotifyAppInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyApp",
		Methods: map[string]rpc.ServeHandlerDescription{
			"exit": {
				MakeArg: func() any {
					var ret [1]ExitArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					err = i.Exit(ctx)
					return
				},
			},
			"mobileAppStateChanged": {
				MakeArg: func() any {
					var ret [1]MobileAppStateChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]MobileAppStateChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]MobileAppStateChangedArg)(nil), args)
						return
					}
					err = i.MobileAppStateChanged(ctx, typedArgs[0].State)
					return
				},
			},
		},
	}
}

type NotifyAppClient struct {
	Cli rpc.GenericClient
}

func (c NotifyAppClient) Exit(ctx context.Context) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyApp.exit", []any{ExitArg{}}, 0*time.Millisecond)
	return
}

func (c NotifyAppClient) MobileAppStateChanged(ctx context.Context, state MobileAppState) (err error) {
	__arg := MobileAppStateChangedArg{State: state}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyApp.mobileAppStateChanged", []any{__arg}, 0*time.Millisecond)
	return
}

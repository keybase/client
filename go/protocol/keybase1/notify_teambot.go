// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_teambot.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type NewTeambotKeyArg struct {
	Id          TeamID               `codec:"id" json:"id"`
	Generation  TeambotKeyGeneration `codec:"generation" json:"generation"`
	Application TeamApplication      `codec:"application" json:"application"`
}

type TeambotKeyNeededArg struct {
	Id          TeamID               `codec:"id" json:"id"`
	Uid         UID                  `codec:"uid" json:"uid"`
	Generation  TeambotKeyGeneration `codec:"generation" json:"generation"`
	Application TeamApplication      `codec:"application" json:"application"`
}

type NotifyTeambotInterface interface {
	NewTeambotKey(context.Context, NewTeambotKeyArg) error
	TeambotKeyNeeded(context.Context, TeambotKeyNeededArg) error
}

func NotifyTeambotProtocol(i NotifyTeambotInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyTeambot",
		Methods: map[string]rpc.ServeHandlerDescription{
			"newTeambotKey": {
				MakeArg: func() interface{} {
					var ret [1]NewTeambotKeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]NewTeambotKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]NewTeambotKeyArg)(nil), args)
						return
					}
					err = i.NewTeambotKey(ctx, typedArgs[0])
					return
				},
			},
			"teambotKeyNeeded": {
				MakeArg: func() interface{} {
					var ret [1]TeambotKeyNeededArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TeambotKeyNeededArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TeambotKeyNeededArg)(nil), args)
						return
					}
					err = i.TeambotKeyNeeded(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type NotifyTeambotClient struct {
	Cli rpc.GenericClient
}

func (c NotifyTeambotClient) NewTeambotKey(ctx context.Context, __arg NewTeambotKeyArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTeambot.newTeambotKey", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyTeambotClient) TeambotKeyNeeded(ctx context.Context, __arg TeambotKeyNeededArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.NotifyTeambot.teambotKeyNeeded", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

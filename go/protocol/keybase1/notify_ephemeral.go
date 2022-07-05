// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_ephemeral.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type NewTeamEkArg struct {
	Id         TeamID       `codec:"id" json:"id"`
	Generation EkGeneration `codec:"generation" json:"generation"`
}

type NewTeambotEkArg struct {
	Id         TeamID       `codec:"id" json:"id"`
	Generation EkGeneration `codec:"generation" json:"generation"`
}

type TeambotEkNeededArg struct {
	Id                    TeamID        `codec:"id" json:"id"`
	Uid                   UID           `codec:"uid" json:"uid"`
	Generation            EkGeneration  `codec:"generation" json:"generation"`
	ForceCreateGeneration *EkGeneration `codec:"forceCreateGeneration,omitempty" json:"forceCreateGeneration,omitempty"`
}

type NotifyEphemeralInterface interface {
	NewTeamEk(context.Context, NewTeamEkArg) error
	NewTeambotEk(context.Context, NewTeambotEkArg) error
	TeambotEkNeeded(context.Context, TeambotEkNeededArg) error
}

func NotifyEphemeralProtocol(i NotifyEphemeralInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyEphemeral",
		Methods: map[string]rpc.ServeHandlerDescription{
			"newTeamEk": {
				MakeArg: func() interface{} {
					var ret [1]NewTeamEkArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]NewTeamEkArg)
					if !ok {
						err = rpc.NewTypeError((*[1]NewTeamEkArg)(nil), args)
						return
					}
					err = i.NewTeamEk(ctx, typedArgs[0])
					return
				},
			},
			"newTeambotEk": {
				MakeArg: func() interface{} {
					var ret [1]NewTeambotEkArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]NewTeambotEkArg)
					if !ok {
						err = rpc.NewTypeError((*[1]NewTeambotEkArg)(nil), args)
						return
					}
					err = i.NewTeambotEk(ctx, typedArgs[0])
					return
				},
			},
			"teambotEkNeeded": {
				MakeArg: func() interface{} {
					var ret [1]TeambotEkNeededArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TeambotEkNeededArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TeambotEkNeededArg)(nil), args)
						return
					}
					err = i.TeambotEkNeeded(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type NotifyEphemeralClient struct {
	Cli rpc.GenericClient
}

func (c NotifyEphemeralClient) NewTeamEk(ctx context.Context, __arg NewTeamEkArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyEphemeral.newTeamEk", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyEphemeralClient) NewTeambotEk(ctx context.Context, __arg NewTeambotEkArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.NotifyEphemeral.newTeambotEk", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c NotifyEphemeralClient) TeambotEkNeeded(ctx context.Context, __arg TeambotEkNeededArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.NotifyEphemeral.teambotEkNeeded", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

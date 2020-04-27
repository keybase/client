// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/revoke.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type RevokeKeyArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	KeyID     KID `codec:"keyID" json:"keyID"`
}

type RevokeDeviceArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	DeviceID  DeviceID `codec:"deviceID" json:"deviceID"`
	ForceSelf bool     `codec:"forceSelf" json:"forceSelf"`
	ForceLast bool     `codec:"forceLast" json:"forceLast"`
}

type RevokeSigsArg struct {
	SessionID    int      `codec:"sessionID" json:"sessionID"`
	SigIDQueries []string `codec:"sigIDQueries" json:"sigIDQueries"`
}

type RevokeInterface interface {
	RevokeKey(context.Context, RevokeKeyArg) error
	RevokeDevice(context.Context, RevokeDeviceArg) error
	RevokeSigs(context.Context, RevokeSigsArg) error
}

func RevokeProtocol(i RevokeInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.revoke",
		Methods: map[string]rpc.ServeHandlerDescription{
			"revokeKey": {
				MakeArg: func() interface{} {
					var ret [1]RevokeKeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RevokeKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RevokeKeyArg)(nil), args)
						return
					}
					err = i.RevokeKey(ctx, typedArgs[0])
					return
				},
			},
			"revokeDevice": {
				MakeArg: func() interface{} {
					var ret [1]RevokeDeviceArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RevokeDeviceArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RevokeDeviceArg)(nil), args)
						return
					}
					err = i.RevokeDevice(ctx, typedArgs[0])
					return
				},
			},
			"revokeSigs": {
				MakeArg: func() interface{} {
					var ret [1]RevokeSigsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RevokeSigsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RevokeSigsArg)(nil), args)
						return
					}
					err = i.RevokeSigs(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type RevokeClient struct {
	Cli rpc.GenericClient
}

func (c RevokeClient) RevokeKey(ctx context.Context, __arg RevokeKeyArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.revoke.revokeKey", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c RevokeClient) RevokeDevice(ctx context.Context, __arg RevokeDeviceArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.revoke.revokeDevice", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c RevokeClient) RevokeSigs(ctx context.Context, __arg RevokeSigsArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.revoke.revokeSigs", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

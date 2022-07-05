// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/badger.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type GetBadgeStateArg struct {
}

type BadgerInterface interface {
	GetBadgeState(context.Context) (BadgeState, error)
}

func BadgerProtocol(i BadgerInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.badger",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getBadgeState": {
				MakeArg: func() interface{} {
					var ret [1]GetBadgeStateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetBadgeState(ctx)
					return
				},
			},
		},
	}
}

type BadgerClient struct {
	Cli rpc.GenericClient
}

func (c BadgerClient) GetBadgeState(ctx context.Context) (res BadgeState, err error) {
	err = c.Cli.Call(ctx, "keybase.1.badger.getBadgeState", []interface{}{GetBadgeStateArg{}}, &res, 0*time.Millisecond)
	return
}

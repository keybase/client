// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/btc.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type RegisterBTCArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Address   string `codec:"address" json:"address"`
	Force     bool   `codec:"force" json:"force"`
}

type BTCInterface interface {
	RegisterBTC(context.Context, RegisterBTCArg) error
}

func BTCProtocol(i BTCInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.BTC",
		Methods: map[string]rpc.ServeHandlerDescription{
			"registerBTC": {
				MakeArg: func() interface{} {
					var ret [1]RegisterBTCArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RegisterBTCArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RegisterBTCArg)(nil), args)
						return
					}
					err = i.RegisterBTC(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type BTCClient struct {
	Cli rpc.GenericClient
}

func (c BTCClient) RegisterBTC(ctx context.Context, __arg RegisterBTCArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.BTC.registerBTC", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

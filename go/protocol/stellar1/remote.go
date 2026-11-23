// Code generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler). DO NOT EDIT.
//   Input file: avdl/stellar1/remote.avdl

package stellar1

import (
	"context"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type BalancesArg struct {
	Caller    keybase1.UserVersion `codec:"caller" json:"caller"`
	AccountID AccountID            `codec:"accountID" json:"accountID"`
}

type RemoteInterface interface {
	Balances(context.Context, BalancesArg) ([]Balance, error)
}

func RemoteProtocol(i RemoteInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "stellar.1.remote",
		Methods: map[string]rpc.ServeHandlerDescription{
			"balances": {
				MakeArg: func() any {
					var ret [1]BalancesArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]BalancesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BalancesArg)(nil), args)
						return
					}
					ret, err = i.Balances(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type RemoteClient struct {
	Cli rpc.GenericClient
}

func (c RemoteClient) Balances(ctx context.Context, __arg BalancesArg) (res []Balance, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.balances", []any{__arg}, &res, 0*time.Millisecond)
	return
}

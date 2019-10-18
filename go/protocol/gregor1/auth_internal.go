// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/gregor1/auth_internal.avdl

package gregor1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type CreateGregorSuperUserSessionTokenArg struct {
}

type AuthInternalInterface interface {
	CreateGregorSuperUserSessionToken(context.Context) (SessionToken, error)
}

func AuthInternalProtocol(i AuthInternalInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "gregor.1.authInternal",
		Methods: map[string]rpc.ServeHandlerDescription{
			"createGregorSuperUserSessionToken": {
				MakeArg: func() interface{} {
					var ret [1]CreateGregorSuperUserSessionTokenArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.CreateGregorSuperUserSessionToken(ctx)
					return
				},
			},
		},
	}
}

type AuthInternalClient struct {
	Cli rpc.GenericClient
}

func (c AuthInternalClient) CreateGregorSuperUserSessionToken(ctx context.Context) (res SessionToken, err error) {
	err = c.Cli.Call(ctx, "gregor.1.authInternal.createGregorSuperUserSessionToken", []interface{}{CreateGregorSuperUserSessionTokenArg{}}, &res, 0*time.Millisecond)
	return
}

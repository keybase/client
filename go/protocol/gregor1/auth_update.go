// Auto-generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/gregor1/auth_update.avdl

package gregor1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type RevokeSessionIDsArg struct {
	SessionIDs []SessionID `codec:"sessionIDs" json:"sessionIDs"`
}

type AuthUpdateInterface interface {
	RevokeSessionIDs(context.Context, []SessionID) error
}

func AuthUpdateProtocol(i AuthUpdateInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "gregor.1.authUpdate",
		Methods: map[string]rpc.ServeHandlerDescription{
			"revokeSessionIDs": {
				MakeArg: func() interface{} {
					var ret [1]RevokeSessionIDsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RevokeSessionIDsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RevokeSessionIDsArg)(nil), args)
						return
					}
					err = i.RevokeSessionIDs(ctx, typedArgs[0].SessionIDs)
					return
				},
			},
		},
	}
}

type AuthUpdateClient struct {
	Cli rpc.GenericClient
}

func (c AuthUpdateClient) RevokeSessionIDs(ctx context.Context, sessionIDs []SessionID) (err error) {
	__arg := RevokeSessionIDsArg{SessionIDs: sessionIDs}
	err = c.Cli.Call(ctx, "gregor.1.authUpdate.revokeSessionIDs", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_keyfamily.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type KeyfamilyChangedArg struct {
	Uid UID `codec:"uid" json:"uid"`
}

type NotifyKeyfamilyInterface interface {
	KeyfamilyChanged(context.Context, UID) error
}

func NotifyKeyfamilyProtocol(i NotifyKeyfamilyInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyKeyfamily",
		Methods: map[string]rpc.ServeHandlerDescription{
			"keyfamilyChanged": {
				MakeArg: func() interface{} {
					var ret [1]KeyfamilyChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]KeyfamilyChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]KeyfamilyChangedArg)(nil), args)
						return
					}
					err = i.KeyfamilyChanged(ctx, typedArgs[0].Uid)
					return
				},
			},
		},
	}
}

type NotifyKeyfamilyClient struct {
	Cli rpc.GenericClient
}

func (c NotifyKeyfamilyClient) KeyfamilyChanged(ctx context.Context, uid UID) (err error) {
	__arg := KeyfamilyChangedArg{Uid: uid}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyKeyfamily.keyfamilyChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}

// Code generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler). DO NOT EDIT.
//   Input file: avdl/keybase1/notify_paperkey.avdl

package keybase1

import (
	"context"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"time"
)

type PaperKeyCachedArg struct {
	Uid    UID `codec:"uid" json:"uid"`
	EncKID KID `codec:"encKID" json:"encKID"`
	SigKID KID `codec:"sigKID" json:"sigKID"`
}

type NotifyPaperKeyInterface interface {
	PaperKeyCached(context.Context, PaperKeyCachedArg) error
}

func NotifyPaperKeyProtocol(i NotifyPaperKeyInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyPaperKey",
		Methods: map[string]rpc.ServeHandlerDescription{
			"paperKeyCached": {
				MakeArg: func() any {
					var ret [1]PaperKeyCachedArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]PaperKeyCachedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PaperKeyCachedArg)(nil), args)
						return
					}
					err = i.PaperKeyCached(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type NotifyPaperKeyClient struct {
	Cli rpc.GenericClient
}

func (c NotifyPaperKeyClient) PaperKeyCached(ctx context.Context, __arg PaperKeyCachedArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyPaperKey.paperKeyCached", []any{__arg}, 0*time.Millisecond)
	return
}

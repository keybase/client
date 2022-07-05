// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_fs_request.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type FSEditListRequestArg struct {
	Req FSEditListRequest `codec:"req" json:"req"`
}

type FSSyncStatusRequestArg struct {
	Req FSSyncStatusRequest `codec:"req" json:"req"`
}

type NotifyFSRequestInterface interface {
	FSEditListRequest(context.Context, FSEditListRequest) error
	FSSyncStatusRequest(context.Context, FSSyncStatusRequest) error
}

func NotifyFSRequestProtocol(i NotifyFSRequestInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyFSRequest",
		Methods: map[string]rpc.ServeHandlerDescription{
			"FSEditListRequest": {
				MakeArg: func() interface{} {
					var ret [1]FSEditListRequestArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSEditListRequestArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSEditListRequestArg)(nil), args)
						return
					}
					err = i.FSEditListRequest(ctx, typedArgs[0].Req)
					return
				},
			},
			"FSSyncStatusRequest": {
				MakeArg: func() interface{} {
					var ret [1]FSSyncStatusRequestArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FSSyncStatusRequestArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FSSyncStatusRequestArg)(nil), args)
						return
					}
					err = i.FSSyncStatusRequest(ctx, typedArgs[0].Req)
					return
				},
			},
		},
	}
}

type NotifyFSRequestClient struct {
	Cli rpc.GenericClient
}

func (c NotifyFSRequestClient) FSEditListRequest(ctx context.Context, req FSEditListRequest) (err error) {
	__arg := FSEditListRequestArg{Req: req}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFSRequest.FSEditListRequest", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyFSRequestClient) FSSyncStatusRequest(ctx context.Context, req FSSyncStatusRequest) (err error) {
	__arg := FSSyncStatusRequestArg{Req: req}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFSRequest.FSSyncStatusRequest", []interface{}{__arg}, 0*time.Millisecond)
	return
}

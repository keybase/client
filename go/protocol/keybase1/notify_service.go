// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_service.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type HttpSrvInfo struct {
	Address string `codec:"address" json:"address"`
	Token   string `codec:"token" json:"token"`
}

func (o HttpSrvInfo) DeepCopy() HttpSrvInfo {
	return HttpSrvInfo{
		Address: o.Address,
		Token:   o.Token,
	}
}

type HTTPSrvInfoUpdateArg struct {
	Info HttpSrvInfo `codec:"info" json:"info"`
}

type HandleKeybaseLinkArg struct {
	Link     string `codec:"link" json:"link"`
	Deferred bool   `codec:"deferred" json:"deferred"`
}

type ShutdownArg struct {
	Code int `codec:"code" json:"code"`
}

type NotifyServiceInterface interface {
	HTTPSrvInfoUpdate(context.Context, HttpSrvInfo) error
	HandleKeybaseLink(context.Context, HandleKeybaseLinkArg) error
	Shutdown(context.Context, int) error
}

func NotifyServiceProtocol(i NotifyServiceInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyService",
		Methods: map[string]rpc.ServeHandlerDescription{
			"HTTPSrvInfoUpdate": {
				MakeArg: func() interface{} {
					var ret [1]HTTPSrvInfoUpdateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]HTTPSrvInfoUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]HTTPSrvInfoUpdateArg)(nil), args)
						return
					}
					err = i.HTTPSrvInfoUpdate(ctx, typedArgs[0].Info)
					return
				},
			},
			"handleKeybaseLink": {
				MakeArg: func() interface{} {
					var ret [1]HandleKeybaseLinkArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]HandleKeybaseLinkArg)
					if !ok {
						err = rpc.NewTypeError((*[1]HandleKeybaseLinkArg)(nil), args)
						return
					}
					err = i.HandleKeybaseLink(ctx, typedArgs[0])
					return
				},
			},
			"shutdown": {
				MakeArg: func() interface{} {
					var ret [1]ShutdownArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ShutdownArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ShutdownArg)(nil), args)
						return
					}
					err = i.Shutdown(ctx, typedArgs[0].Code)
					return
				},
			},
		},
	}
}

type NotifyServiceClient struct {
	Cli rpc.GenericClient
}

func (c NotifyServiceClient) HTTPSrvInfoUpdate(ctx context.Context, info HttpSrvInfo) (err error) {
	__arg := HTTPSrvInfoUpdateArg{Info: info}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyService.HTTPSrvInfoUpdate", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyServiceClient) HandleKeybaseLink(ctx context.Context, __arg HandleKeybaseLinkArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyService.handleKeybaseLink", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyServiceClient) Shutdown(ctx context.Context, code int) (err error) {
	__arg := ShutdownArg{Code: code}
	err = c.Cli.Call(ctx, "keybase.1.NotifyService.shutdown", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

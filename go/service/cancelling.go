package service

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

func CancellingProtocol(g *libkb.GlobalContext, prot rpc.Protocol) (res rpc.Protocol) {
	res.Name = prot.Name
	res.WrapError = prot.WrapError
	res.Methods = make(map[string]rpc.ServeHandlerDescription)
	for name, desc := range prot.Methods {
		var newDesc rpc.ServeHandlerDescription
		newDesc.MakeArg = desc.MakeArg
		newDesc.MethodType = desc.MethodType
		newDesc.Handler = func(ctx context.Context, arg interface{}) (interface{}, error) {
			var ctxID string
			ctx, ctxID = g.RPCCanceller.RegisterContext(ctx)
			defer g.RPCCanceller.UnregisterContext(ctxID)
			return desc.Handler(ctx, arg)
		}
		res.Methods[name] = newDesc
	}
	return res
}

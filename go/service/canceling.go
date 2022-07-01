package service

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

func CancelingProtocol(g *libkb.GlobalContext, prot rpc.Protocol, reason libkb.RPCCancelerReason) (res rpc.Protocol) {
	res.Name = prot.Name
	res.WrapError = prot.WrapError
	res.Methods = make(map[string]rpc.ServeHandlerDescription)
	for name, ldesc := range prot.Methods {
		var newDesc rpc.ServeHandlerDescription
		desc := ldesc
		newDesc.MakeArg = desc.MakeArg
		newDesc.Handler = func(ctx context.Context, arg interface{}) (interface{}, error) {
			var ctxID libkb.RPCCancelerKey
			ctx, ctxID = g.RPCCanceler.RegisterContext(ctx, reason)
			defer g.RPCCanceler.UnregisterContext(ctxID)
			return desc.Handler(ctx, arg)
		}
		res.Methods[name] = newDesc
	}
	return res
}

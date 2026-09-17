package service

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func ChatSessionGatingProtocol(g *globals.Context, prot rpc.Protocol) (res rpc.Protocol) {
	res.Name = prot.Name
	res.WrapError = prot.WrapError
	res.Methods = make(map[string]rpc.ServeHandlerDescription)
	for name, ldesc := range prot.Methods {
		var newDesc rpc.ServeHandlerDescription
		desc := ldesc
		newDesc.MakeArg = desc.MakeArg
		newDesc.Handler = func(ctx context.Context, arg any) (any, error) {
			ctx, err := globals.BindChatSession(ctx, g)
			if err != nil {
				return nil, err
			}
			return desc.Handler(ctx, arg)
		}
		res.Methods[name] = newDesc
	}
	return res
}

func CancelingProtocol(g *libkb.GlobalContext, prot rpc.Protocol, reason libkb.RPCCancelerReason) (res rpc.Protocol) {
	res.Name = prot.Name
	res.WrapError = prot.WrapError
	res.Methods = make(map[string]rpc.ServeHandlerDescription)
	for name, ldesc := range prot.Methods {
		var newDesc rpc.ServeHandlerDescription
		desc := ldesc
		newDesc.MakeArg = desc.MakeArg
		newDesc.Handler = func(ctx context.Context, arg any) (any, error) {
			var ctxID libkb.RPCCancelerKey
			ctx, ctxID = g.RPCCanceler.RegisterContext(ctx, reason)
			defer g.RPCCanceler.UnregisterContext(ctxID)
			return desc.Handler(ctx, arg)
		}
		res.Methods[name] = newDesc
	}
	return res
}

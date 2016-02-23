package metricsutil

import (
	"github.com/keybase/go-framed-msgpack-rpc"
	metrics "github.com/rcrowley/go-metrics"
	"golang.org/x/net/context"
)

type rpcHandler func(ctx context.Context, arg interface{}) (ret interface{}, err error)

func wrapHandler(name string, h rpcHandler, r metrics.Registry) rpcHandler {
	timer := metrics.GetOrRegisterTimer(name, r)
	return func(ctx context.Context, arg interface{}) (
		ret interface{}, err error) {
		timer.Time(func() {
			ret, err = h(ctx, arg)
		})
		return ret, err
	}
}

func wrapDescription(name string, desc rpc.ServeHandlerDescription,
	r metrics.Registry) rpc.ServeHandlerDescription {
	return rpc.ServeHandlerDescription{
		MakeArg:    desc.MakeArg,
		Handler:    wrapHandler(name, desc.Handler, r),
		MethodType: desc.MethodType,
	}
}

// WrapProtocol returns a protocol which inserts timers for every
// method in the protocol, if r is non-nil. If r is nil, the given
// protocol is returned unchanged.
func WrapProtocol(p rpc.Protocol, r InboundRegistry) rpc.Protocol {
	if r.Registry == nil {
		return p
	}

	methods := make(map[string]rpc.ServeHandlerDescription)
	for methodName, desc := range p.Methods {
		methods[methodName] = wrapDescription(
			p.Name+"."+methodName, desc, r)
	}
	return rpc.Protocol{
		Name:      p.Name,
		Methods:   methods,
		WrapError: p.WrapError,
	}
}

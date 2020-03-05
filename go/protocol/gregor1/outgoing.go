// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/gregor1/outgoing.avdl

package gregor1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type BroadcastMessageArg struct {
	M Message `codec:"m" json:"m"`
}

type OutgoingInterface interface {
	BroadcastMessage(context.Context, Message) error
}

func OutgoingProtocol(i OutgoingInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "gregor.1.outgoing",
		Methods: map[string]rpc.ServeHandlerDescription{
			"broadcastMessage": {
				MakeArg: func() interface{} {
					var ret [1]BroadcastMessageArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BroadcastMessageArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BroadcastMessageArg)(nil), args)
						return
					}
					err = i.BroadcastMessage(ctx, typedArgs[0].M)
					return
				},
			},
		},
	}
}

type OutgoingClient struct {
	Cli rpc.GenericClient
}

func (c OutgoingClient) BroadcastMessage(ctx context.Context, m Message) (err error) {
	__arg := BroadcastMessageArg{M: m}
	err = c.Cli.CallCompressed(ctx, "gregor.1.outgoing.broadcastMessage", []interface{}{__arg}, nil, rpc.CompressionGzip, 0*time.Millisecond)
	return
}

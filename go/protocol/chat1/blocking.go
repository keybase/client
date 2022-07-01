// Auto-generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/chat1/blocking.avdl

package chat1

import (
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type BlockConversationsArg struct {
	Uid             gregor1.UID `codec:"uid" json:"uid"`
	TlfIDsBlocked   []TLFID     `codec:"tlfIDsBlocked" json:"tlfIDsBlocked"`
	TlfIDsUnblocked []TLFID     `codec:"tlfIDsUnblocked" json:"tlfIDsUnblocked"`
}

type BlockingInterface interface {
	BlockConversations(context.Context, BlockConversationsArg) error
}

func BlockingProtocol(i BlockingInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "chat.1.blocking",
		Methods: map[string]rpc.ServeHandlerDescription{
			"blockConversations": {
				MakeArg: func() interface{} {
					var ret [1]BlockConversationsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BlockConversationsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BlockConversationsArg)(nil), args)
						return
					}
					err = i.BlockConversations(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type BlockingClient struct {
	Cli rpc.GenericClient
}

func (c BlockingClient) BlockConversations(ctx context.Context, __arg BlockConversationsArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.blocking.blockConversations", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

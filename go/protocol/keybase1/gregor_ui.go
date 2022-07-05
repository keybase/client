// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/gregor_ui.avdl

package keybase1

import (
	"fmt"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type PushReason int

const (
	PushReason_NONE        PushReason = 0
	PushReason_RECONNECTED PushReason = 1
	PushReason_NEW_DATA    PushReason = 2
)

func (o PushReason) DeepCopy() PushReason { return o }

var PushReasonMap = map[string]PushReason{
	"NONE":        0,
	"RECONNECTED": 1,
	"NEW_DATA":    2,
}

var PushReasonRevMap = map[PushReason]string{
	0: "NONE",
	1: "RECONNECTED",
	2: "NEW_DATA",
}

func (e PushReason) String() string {
	if v, ok := PushReasonRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PushStateArg struct {
	State  gregor1.State `codec:"state" json:"state"`
	Reason PushReason    `codec:"reason" json:"reason"`
}

type PushOutOfBandMessagesArg struct {
	Oobm []gregor1.OutOfBandMessage `codec:"oobm" json:"oobm"`
}

type GregorUIInterface interface {
	PushState(context.Context, PushStateArg) error
	PushOutOfBandMessages(context.Context, []gregor1.OutOfBandMessage) error
}

func GregorUIProtocol(i GregorUIInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.gregorUI",
		Methods: map[string]rpc.ServeHandlerDescription{
			"pushState": {
				MakeArg: func() interface{} {
					var ret [1]PushStateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PushStateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PushStateArg)(nil), args)
						return
					}
					err = i.PushState(ctx, typedArgs[0])
					return
				},
			},
			"pushOutOfBandMessages": {
				MakeArg: func() interface{} {
					var ret [1]PushOutOfBandMessagesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PushOutOfBandMessagesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PushOutOfBandMessagesArg)(nil), args)
						return
					}
					err = i.PushOutOfBandMessages(ctx, typedArgs[0].Oobm)
					return
				},
			},
		},
	}
}

type GregorUIClient struct {
	Cli rpc.GenericClient
}

func (c GregorUIClient) PushState(ctx context.Context, __arg PushStateArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.gregorUI.pushState", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c GregorUIClient) PushOutOfBandMessages(ctx context.Context, oobm []gregor1.OutOfBandMessage) (err error) {
	__arg := PushOutOfBandMessagesArg{Oobm: oobm}
	err = c.Cli.Notify(ctx, "keybase.1.gregorUI.pushOutOfBandMessages", []interface{}{__arg}, 0*time.Millisecond)
	return
}

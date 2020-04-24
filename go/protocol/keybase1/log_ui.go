// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/log_ui.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type LogArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Level     LogLevel `codec:"level" json:"level"`
	Text      Text     `codec:"text" json:"text"`
}

type LogUiInterface interface {
	Log(context.Context, LogArg) error
}

func LogUiProtocol(i LogUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.logUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"log": {
				MakeArg: func() interface{} {
					var ret [1]LogArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LogArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LogArg)(nil), args)
						return
					}
					err = i.Log(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type LogUiClient struct {
	Cli rpc.GenericClient
}

func (c LogUiClient) Log(ctx context.Context, __arg LogArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.logUi.log", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/log.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type RegisterLoggerArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Name      string   `codec:"name" json:"name"`
	Level     LogLevel `codec:"level" json:"level"`
}

type LogInterface interface {
	RegisterLogger(context.Context, RegisterLoggerArg) error
}

func LogProtocol(i LogInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.log",
		Methods: map[string]rpc.ServeHandlerDescription{
			"registerLogger": {
				MakeArg: func() interface{} {
					var ret [1]RegisterLoggerArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RegisterLoggerArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RegisterLoggerArg)(nil), args)
						return
					}
					err = i.RegisterLogger(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type LogClient struct {
	Cli rpc.GenericClient
}

func (c LogClient) RegisterLogger(ctx context.Context, __arg RegisterLoggerArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.log.registerLogger", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

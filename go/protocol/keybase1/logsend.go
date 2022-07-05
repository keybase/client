// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/logsend.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type PrepareLogsendArg struct {
}

type LogsendInterface interface {
	PrepareLogsend(context.Context) error
}

func LogsendProtocol(i LogsendInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.logsend",
		Methods: map[string]rpc.ServeHandlerDescription{
			"prepareLogsend": {
				MakeArg: func() interface{} {
					var ret [1]PrepareLogsendArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.PrepareLogsend(ctx)
					return
				},
			},
		},
	}
}

type LogsendClient struct {
	Cli rpc.GenericClient
}

func (c LogsendClient) PrepareLogsend(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.logsend.prepareLogsend", []interface{}{PrepareLogsendArg{}}, nil, 0*time.Millisecond)
	return
}

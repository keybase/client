// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_app.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type ExitArg struct {
}

type NotifyAppInterface interface {
	Exit(context.Context) error
}

func NotifyAppProtocol(i NotifyAppInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyApp",
		Methods: map[string]rpc.ServeHandlerDescription{
			"exit": {
				MakeArg: func() interface{} {
					var ret [1]ExitArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.Exit(ctx)
					return
				},
			},
		},
	}
}

type NotifyAppClient struct {
	Cli rpc.GenericClient
}

func (c NotifyAppClient) Exit(ctx context.Context) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyApp.exit", []interface{}{ExitArg{}}, 0*time.Millisecond)
	return
}

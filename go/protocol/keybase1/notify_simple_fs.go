// Auto-generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_simple_fs.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type SimpleFSArchiveStatusChangedArg struct {
	Status SimpleFSArchiveStatus `codec:"status" json:"status"`
}

type NotifySimpleFSInterface interface {
	SimpleFSArchiveStatusChanged(context.Context, SimpleFSArchiveStatus) error
}

func NotifySimpleFSProtocol(i NotifySimpleFSInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifySimpleFS",
		Methods: map[string]rpc.ServeHandlerDescription{
			"simpleFSArchiveStatusChanged": {
				MakeArg: func() interface{} {
					var ret [1]SimpleFSArchiveStatusChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SimpleFSArchiveStatusChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SimpleFSArchiveStatusChangedArg)(nil), args)
						return
					}
					err = i.SimpleFSArchiveStatusChanged(ctx, typedArgs[0].Status)
					return
				},
			},
		},
	}
}

type NotifySimpleFSClient struct {
	Cli rpc.GenericClient
}

func (c NotifySimpleFSClient) SimpleFSArchiveStatusChanged(ctx context.Context, status SimpleFSArchiveStatus) (err error) {
	__arg := SimpleFSArchiveStatusChangedArg{Status: status}
	err = c.Cli.Notify(ctx, "keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}

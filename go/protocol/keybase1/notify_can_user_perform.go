// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_can_user_perform.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type CanUserPerformChangedArg struct {
	TeamName string `codec:"teamName" json:"teamName"`
}

type NotifyCanUserPerformInterface interface {
	CanUserPerformChanged(context.Context, string) error
}

func NotifyCanUserPerformProtocol(i NotifyCanUserPerformInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyCanUserPerform",
		Methods: map[string]rpc.ServeHandlerDescription{
			"canUserPerformChanged": {
				MakeArg: func() interface{} {
					var ret [1]CanUserPerformChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CanUserPerformChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CanUserPerformChangedArg)(nil), args)
						return
					}
					err = i.CanUserPerformChanged(ctx, typedArgs[0].TeamName)
					return
				},
			},
		},
	}
}

type NotifyCanUserPerformClient struct {
	Cli rpc.GenericClient
}

func (c NotifyCanUserPerformClient) CanUserPerformChanged(ctx context.Context, teamName string) (err error) {
	__arg := CanUserPerformChangedArg{TeamName: teamName}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyCanUserPerform.canUserPerformChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}

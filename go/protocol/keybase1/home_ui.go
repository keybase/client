// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/home_ui.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type HomeUIRefreshArg struct {
}

type HomeUIInterface interface {
	HomeUIRefresh(context.Context) error
}

func HomeUIProtocol(i HomeUIInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.homeUI",
		Methods: map[string]rpc.ServeHandlerDescription{
			"homeUIRefresh": {
				MakeArg: func() interface{} {
					var ret [1]HomeUIRefreshArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.HomeUIRefresh(ctx)
					return
				},
			},
		},
	}
}

type HomeUIClient struct {
	Cli rpc.GenericClient
}

func (c HomeUIClient) HomeUIRefresh(ctx context.Context) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.homeUI.homeUIRefresh", []interface{}{HomeUIRefreshArg{}}, 0*time.Millisecond)
	return
}

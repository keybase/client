// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_featuredbots.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type FeaturedBotsUpdateArg struct {
	Bots   []FeaturedBot `codec:"bots" json:"bots"`
	Limit  int           `codec:"limit" json:"limit"`
	Offset int           `codec:"offset" json:"offset"`
}

type NotifyFeaturedBotsInterface interface {
	FeaturedBotsUpdate(context.Context, FeaturedBotsUpdateArg) error
}

func NotifyFeaturedBotsProtocol(i NotifyFeaturedBotsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyFeaturedBots",
		Methods: map[string]rpc.ServeHandlerDescription{
			"featuredBotsUpdate": {
				MakeArg: func() interface{} {
					var ret [1]FeaturedBotsUpdateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FeaturedBotsUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FeaturedBotsUpdateArg)(nil), args)
						return
					}
					err = i.FeaturedBotsUpdate(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type NotifyFeaturedBotsClient struct {
	Cli rpc.GenericClient
}

func (c NotifyFeaturedBotsClient) FeaturedBotsUpdate(ctx context.Context, __arg FeaturedBotsUpdateArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFeaturedBots.featuredBotsUpdate", []interface{}{__arg}, 0*time.Millisecond)
	return
}

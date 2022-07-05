// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/bot.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type BotToken string

func (o BotToken) DeepCopy() BotToken {
	return o
}

type BotTokenInfo struct {
	Token BotToken `codec:"token" json:"bot_token"`
	Ctime Time     `codec:"ctime" json:"ctime"`
}

func (o BotTokenInfo) DeepCopy() BotTokenInfo {
	return BotTokenInfo{
		Token: o.Token.DeepCopy(),
		Ctime: o.Ctime.DeepCopy(),
	}
}

type BotTokenListArg struct {
}

type BotTokenCreateArg struct {
}

type BotTokenDeleteArg struct {
	Token BotToken `codec:"token" json:"token"`
}

type BotInterface interface {
	BotTokenList(context.Context) ([]BotTokenInfo, error)
	BotTokenCreate(context.Context) (BotToken, error)
	BotTokenDelete(context.Context, BotToken) error
}

func BotProtocol(i BotInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.bot",
		Methods: map[string]rpc.ServeHandlerDescription{
			"botTokenList": {
				MakeArg: func() interface{} {
					var ret [1]BotTokenListArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.BotTokenList(ctx)
					return
				},
			},
			"botTokenCreate": {
				MakeArg: func() interface{} {
					var ret [1]BotTokenCreateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.BotTokenCreate(ctx)
					return
				},
			},
			"botTokenDelete": {
				MakeArg: func() interface{} {
					var ret [1]BotTokenDeleteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BotTokenDeleteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BotTokenDeleteArg)(nil), args)
						return
					}
					err = i.BotTokenDelete(ctx, typedArgs[0].Token)
					return
				},
			},
		},
	}
}

type BotClient struct {
	Cli rpc.GenericClient
}

func (c BotClient) BotTokenList(ctx context.Context) (res []BotTokenInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.bot.botTokenList", []interface{}{BotTokenListArg{}}, &res, 0*time.Millisecond)
	return
}

func (c BotClient) BotTokenCreate(ctx context.Context) (res BotToken, err error) {
	err = c.Cli.Call(ctx, "keybase.1.bot.botTokenCreate", []interface{}{BotTokenCreateArg{}}, &res, 0*time.Millisecond)
	return
}

func (c BotClient) BotTokenDelete(ctx context.Context, token BotToken) (err error) {
	__arg := BotTokenDeleteArg{Token: token}
	err = c.Cli.Call(ctx, "keybase.1.bot.botTokenDelete", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

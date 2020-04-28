// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/featured_bot.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type FeaturedBot struct {
	BotAlias               string  `codec:"botAlias" json:"botAlias"`
	Description            string  `codec:"description" json:"description"`
	ExtendedDescription    string  `codec:"extendedDescription" json:"extendedDescription"`
	ExtendedDescriptionRaw string  `codec:"extendedDescriptionRaw" json:"extendedDescriptionRaw"`
	BotUsername            string  `codec:"botUsername" json:"botUsername"`
	OwnerTeam              *string `codec:"ownerTeam,omitempty" json:"ownerTeam,omitempty"`
	OwnerUser              *string `codec:"ownerUser,omitempty" json:"ownerUser,omitempty"`
	Rank                   int     `codec:"rank" json:"rank"`
	IsPromoted             bool    `codec:"isPromoted" json:"isPromoted"`
}

func (o FeaturedBot) DeepCopy() FeaturedBot {
	return FeaturedBot{
		BotAlias:               o.BotAlias,
		Description:            o.Description,
		ExtendedDescription:    o.ExtendedDescription,
		ExtendedDescriptionRaw: o.ExtendedDescriptionRaw,
		BotUsername:            o.BotUsername,
		OwnerTeam: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.OwnerTeam),
		OwnerUser: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.OwnerUser),
		Rank:       o.Rank,
		IsPromoted: o.IsPromoted,
	}
}

type FeaturedBotsRes struct {
	Bots       []FeaturedBot `codec:"bots" json:"bots"`
	IsLastPage bool          `codec:"isLastPage" json:"isLastPage"`
}

func (o FeaturedBotsRes) DeepCopy() FeaturedBotsRes {
	return FeaturedBotsRes{
		Bots: (func(x []FeaturedBot) []FeaturedBot {
			if x == nil {
				return nil
			}
			ret := make([]FeaturedBot, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Bots),
		IsLastPage: o.IsLastPage,
	}
}

type SearchRes struct {
	Bots       []FeaturedBot `codec:"bots" json:"bots"`
	IsLastPage bool          `codec:"isLastPage" json:"isLastPage"`
}

func (o SearchRes) DeepCopy() SearchRes {
	return SearchRes{
		Bots: (func(x []FeaturedBot) []FeaturedBot {
			if x == nil {
				return nil
			}
			ret := make([]FeaturedBot, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Bots),
		IsLastPage: o.IsLastPage,
	}
}

type FeaturedBotsArg struct {
	Limit     int  `codec:"limit" json:"limit"`
	Offset    int  `codec:"offset" json:"offset"`
	SkipCache bool `codec:"skipCache" json:"skipCache"`
}

type SearchArg struct {
	Query  string `codec:"query" json:"query"`
	Limit  int    `codec:"limit" json:"limit"`
	Offset int    `codec:"offset" json:"offset"`
}

type SearchLocalArg struct {
	Query     string `codec:"query" json:"query"`
	Limit     int    `codec:"limit" json:"limit"`
	SkipCache bool   `codec:"skipCache" json:"skipCache"`
}

type FeaturedBotInterface interface {
	FeaturedBots(context.Context, FeaturedBotsArg) (FeaturedBotsRes, error)
	Search(context.Context, SearchArg) (SearchRes, error)
	SearchLocal(context.Context, SearchLocalArg) (SearchRes, error)
}

func FeaturedBotProtocol(i FeaturedBotInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.featuredBot",
		Methods: map[string]rpc.ServeHandlerDescription{
			"featuredBots": {
				MakeArg: func() interface{} {
					var ret [1]FeaturedBotsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FeaturedBotsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FeaturedBotsArg)(nil), args)
						return
					}
					ret, err = i.FeaturedBots(ctx, typedArgs[0])
					return
				},
			},
			"search": {
				MakeArg: func() interface{} {
					var ret [1]SearchArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SearchArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SearchArg)(nil), args)
						return
					}
					ret, err = i.Search(ctx, typedArgs[0])
					return
				},
			},
			"searchLocal": {
				MakeArg: func() interface{} {
					var ret [1]SearchLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SearchLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SearchLocalArg)(nil), args)
						return
					}
					ret, err = i.SearchLocal(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type FeaturedBotClient struct {
	Cli rpc.GenericClient
}

func (c FeaturedBotClient) FeaturedBots(ctx context.Context, __arg FeaturedBotsArg) (res FeaturedBotsRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.featuredBot.featuredBots", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c FeaturedBotClient) Search(ctx context.Context, __arg SearchArg) (res SearchRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.featuredBot.search", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c FeaturedBotClient) SearchLocal(ctx context.Context, __arg SearchLocalArg) (res SearchRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.featuredBot.searchLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

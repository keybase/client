package service

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type FeaturedBotHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewFeaturedBotHandler(xp rpc.Transporter, g *libkb.GlobalContext) *FeaturedBotHandler {
	return &FeaturedBotHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *FeaturedBotHandler) FeaturedBots(ctx context.Context, arg keybase1.FeaturedBotsArg) (res keybase1.FeaturedBotsRes, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())

	apiRes, err := mctx.G().API.Get(mctx, libkb.APIArg{
		Endpoint:    "featured_bots/featured",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"limit":  libkb.I{Val: arg.Limit},
			"offset": libkb.I{Val: arg.Offset},
		},
	})
	if err != nil {
		return res, err
	}

	err = apiRes.Body.UnmarshalAgain(&res)
	return res, err
}

func (h *FeaturedBotHandler) Search(ctx context.Context, arg keybase1.SearchArg) (res keybase1.SearchRes, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())

	apiRes, err := mctx.G().API.Get(mctx, libkb.APIArg{
		Endpoint:    "featured_bots/search",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"query":  libkb.S{Val: arg.Query},
			"limit":  libkb.I{Val: arg.Limit},
			"offset": libkb.I{Val: arg.Offset},
		},
	})
	if err != nil {
		return res, err
	}

	err = apiRes.Body.UnmarshalAgain(&res)
	return res, err
}

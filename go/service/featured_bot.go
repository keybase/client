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
	return h.G().FeaturedBotLoader.FeaturedBots(mctx, arg)
}

func (h *FeaturedBotHandler) Search(ctx context.Context, arg keybase1.SearchArg) (res keybase1.SearchRes, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	return h.G().FeaturedBotLoader.SearchFeaturedBots(mctx, arg)
}

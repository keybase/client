package service

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teambot"
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
	defer mctx.Trace(fmt.Sprintf("FeaturedBots: %+v", arg), &err)()
	return teambot.NewFeaturedBotLoader(h.G()).FeaturedBots(mctx, arg)
}

func (h *FeaturedBotHandler) Search(ctx context.Context, arg keybase1.SearchArg) (res keybase1.SearchRes, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace(fmt.Sprintf("Search: %s", arg), &err)()
	return teambot.NewFeaturedBotLoader(h.G()).Search(mctx, arg)
}

func (h *FeaturedBotHandler) SearchLocal(ctx context.Context, arg keybase1.SearchLocalArg) (res keybase1.SearchRes, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace(fmt.Sprintf("SearchLocal: %s", arg), &err)()
	return teambot.NewFeaturedBotLoader(h.G()).SearchLocal(mctx, arg)
}

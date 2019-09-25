package service

import (
	"context"
	bot "github.com/keybase/client/go/bot"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type BotHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewBotHandler(xp rpc.Transporter, g *libkb.GlobalContext) *BotHandler {
	return &BotHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *BotHandler) BotTokenList(ctx context.Context) (res []keybase1.BotTokenInfo, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("BOT")
	return bot.ListTokens(mctx)
}

func (h *BotHandler) BotTokenCreate(ctx context.Context) (res keybase1.BotToken, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("BOT")
	return bot.CreateToken(mctx)
}

func (h *BotHandler) BotTokenDelete(ctx context.Context, tok keybase1.BotToken) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("BOT")
	return bot.DeleteToken(mctx, tok)
}

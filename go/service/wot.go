package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type WebOfTrustHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewWebOfTrustHandler(xp rpc.Transporter, g *libkb.GlobalContext) *WebOfTrustHandler {
	return &WebOfTrustHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *WebOfTrustHandler) WotVouch(ctx context.Context, arg keybase1.WotVouchArg) error {
	ctx = libkb.WithLogTag(ctx, "WOT")
	mctx := libkb.NewMetaContext(ctx, h.G())

	earg := &engine.WotAttestArg{
		Attestee:     arg.Uv,
		Attestations: arg.Attestations,
		Confidence:   arg.Confidence,
	}

	eng := engine.NewWotAttest(h.G(), earg)
	return engine.RunEngine2(mctx, eng)
}

func (h *WebOfTrustHandler) WotVouchCLI(ctx context.Context, arg keybase1.WotVouchCLIArg) error {
	ctx = libkb.WithLogTag(ctx, "WOT")
	mctx := libkb.NewMetaContext(ctx, h.G())

	upak, _, err := h.G().GetUPAKLoader().Load(libkb.NewLoadUserArg(h.G()).WithName(arg.Assertion))
	if err != nil {
		return err
	}

	earg := &engine.WotAttestArg{
		Attestee:     upak.Base.ToUserVersion(),
		Attestations: arg.Attestations,
		Confidence:   arg.Confidence,
	}

	eng := engine.NewWotAttest(h.G(), earg)
	return engine.RunEngine2(mctx, eng)
}

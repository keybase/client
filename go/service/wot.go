package service

import (
	"fmt"

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

	earg := &engine.WotVouchArg{
		Vouchee:    arg.Uv,
		VouchTexts: arg.VouchTexts,
		Confidence: arg.Confidence,
	}

	eng := engine.NewWotVouch(h.G(), earg)
	return engine.RunEngine2(mctx, eng)
}

func (h *WebOfTrustHandler) WotVouchCLI(ctx context.Context, arg keybase1.WotVouchCLIArg) error {
	ctx = libkb.WithLogTag(ctx, "WOT")
	mctx := libkb.NewMetaContext(ctx, h.G())

	upak, _, err := h.G().GetUPAKLoader().Load(libkb.NewLoadUserArg(h.G()).WithName(arg.Assertion))
	if err != nil {
		return err
	}

	earg := &engine.WotVouchArg{
		Vouchee:    upak.Base.ToUserVersion(),
		VouchTexts: arg.VouchTexts,
		Confidence: arg.Confidence,
	}

	eng := engine.NewWotVouch(h.G(), earg)
	return engine.RunEngine2(mctx, eng)
}

func (h *WebOfTrustHandler) WotListCLI(ctx context.Context, arg keybase1.WotListCLIArg) (res []keybase1.WotVouch, err error) {
	ctx = libkb.WithLogTag(ctx, "WOT")
	mctx := libkb.NewMetaContext(ctx, h.G())
	if arg.Username == nil {
		return libkb.FetchMyWot(mctx)
	}
	return libkb.FetchUserWot(mctx, *arg.Username)
}

func (h *WebOfTrustHandler) WotReact(ctx context.Context, arg keybase1.WotReactArg) error {
	ctx = libkb.WithLogTag(ctx, "WOT")
	mctx := libkb.NewMetaContext(ctx, h.G())

	earg := &engine.WotReactArg{
		Voucher:  arg.Uv,
		Proof:    arg.Proof,
		Reaction: arg.Reaction,
	}
	eng := engine.NewWotReact(h.G(), earg)
	return engine.RunEngine2(mctx, eng)
}

func (h *WebOfTrustHandler) WotReactCLI(ctx context.Context, arg keybase1.WotReactCLIArg) error {
	ctx = libkb.WithLogTag(ctx, "WOT")
	mctx := libkb.NewMetaContext(ctx, h.G())

	upak, _, err := h.G().GetUPAKLoader().Load(libkb.NewLoadUserArg(h.G()).WithName(arg.Username))
	if err != nil {
		return err
	}
	expectedVoucher := upak.Base.ToUserVersion()
	myVouches, err := libkb.FetchMyWot(mctx)
	if err != nil {
		return err
	}
	var reactingVouch *keybase1.WotVouch
	for _, attestation := range myVouches {
		if attestation.Voucher.Eq(expectedVoucher) {
			reactingVouch = &attestation
			break
		}
	}
	if reactingVouch == nil {
		return fmt.Errorf("could not find an attestation of you by %s", arg.Username)
	}

	switch reactingVouch.Status {
	case keybase1.WotStatusType_NONE:
		return fmt.Errorf("something is wrong with this attestation; please ask %s to recreate it", arg.Username)
	case keybase1.WotStatusType_REJECTED:
		return fmt.Errorf("cannot react to an attestation that was previously rejected")
	case keybase1.WotStatusType_REVOKED:
		return fmt.Errorf("cannot react to an attestation that was previously revoked")
	case keybase1.WotStatusType_ACCEPTED:
		if arg.Reaction == keybase1.WotReactionType_ACCEPT {
			return fmt.Errorf("already accepted")
		}
		// rejected a previously accepted vouch, which is fine
	case keybase1.WotStatusType_PROPOSED:
		// expected happy path
	default:
		return fmt.Errorf("unknown status on web-of-trust attestation: %v", reactingVouch.Status)
	}

	rarg := keybase1.WotReactArg{
		SessionID: arg.SessionID,
		Uv:        expectedVoucher,
		Proof:     reactingVouch.VouchProof,
		Reaction:  arg.Reaction,
	}
	return h.WotReact(ctx, rarg)
}

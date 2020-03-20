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
		Vouchee:    arg.Vouchee,
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

	eng := engine.NewResolveThenIdentify2(mctx.G(), &keybase1.Identify2Arg{
		Uid:              upak.GetUID(),
		UserAssertion:    arg.Assertion,
		NeedProofSet:     true,
		UseDelegateUI:    true,
		Reason:           keybase1.IdentifyReason{Reason: fmt.Sprintf("Vouch for %v", arg.Assertion)},
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CLI,
	})
	err = engine.RunEngine2(mctx.WithUIs(libkb.UIs{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, mctx.G()),
	}), eng)
	if err != nil {
		return err
	}
	idRes, err := eng.Result(mctx)
	if err != nil {
		return err
	}
	if idRes == nil {
		return fmt.Errorf("missing identify result")
	}
	if idRes.TrackBreaks != nil {
		mctx.Debug("WotVouchCLI TrackBreaks: %+v", idRes.TrackBreaks)
		return libkb.TrackingBrokeError{}
	}
	failingProofs, err := eng.ResultWotFailingProofs(mctx)
	if err != nil {
		return err
	}
	for i, proof := range failingProofs {
		mctx.Debug("WotVouchCLI failingProofs %v/%v %+v", i+1, len(failingProofs), proof)
	}
	return engine.RunEngine2(mctx, engine.NewWotVouch(h.G(), &engine.WotVouchArg{
		Vouchee:       idRes.Upk.Current.ToUserVersion(),
		Confidence:    arg.Confidence,
		FailingProofs: failingProofs,
		VouchTexts:    arg.VouchTexts,
	}))
}

func (h *WebOfTrustHandler) WotListCLI(ctx context.Context, arg keybase1.WotListCLIArg) (res []keybase1.WotVouch, err error) {
	ctx = libkb.WithLogTag(ctx, "WOT")
	mctx := libkb.NewMetaContext(ctx, h.G())
	return libkb.FetchWotVouches(mctx, libkb.FetchWotVouchesArg{Vouchee: arg.Vouchee, Voucher: arg.Voucher})
}

func (h *WebOfTrustHandler) WotReact(ctx context.Context, arg keybase1.WotReactArg) error {
	ctx = libkb.WithLogTag(ctx, "WOT")
	mctx := libkb.NewMetaContext(ctx, h.G())

	earg := &engine.WotReactArg{
		Voucher:  arg.Voucher,
		Proof:    arg.Proof,
		Reaction: arg.Reaction,
	}
	eng := engine.NewWotReact(h.G(), earg)
	return engine.RunEngine2(mctx, eng)
}

func (h *WebOfTrustHandler) WotReactCLI(ctx context.Context, arg keybase1.WotReactCLIArg) error {
	ctx = libkb.WithLogTag(ctx, "WOT")
	mctx := libkb.NewMetaContext(ctx, h.G())

	upak, _, err := h.G().GetUPAKLoader().Load(libkb.NewLoadUserArg(h.G()).WithName(arg.Voucher))
	if err != nil {
		return err
	}
	expectedVoucher := upak.Base.ToUserVersion()
	myVouches, err := libkb.FetchWotVouches(mctx, libkb.FetchWotVouchesArg{}) // get vouches for me
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
		return fmt.Errorf("could not find an attestation of you by %s", arg.Voucher)
	}

	switch reactingVouch.Status {
	case keybase1.WotStatusType_NONE:
		return fmt.Errorf("something is wrong with this attestation; please ask %s to recreate it", arg.Voucher)
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
		Voucher:   expectedVoucher,
		Proof:     reactingVouch.VouchProof,
		Reaction:  arg.Reaction,
	}
	return h.WotReact(ctx, rarg)
}

func (h *WebOfTrustHandler) DismissWotNotifications(ctx context.Context, arg keybase1.DismissWotNotificationsArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("DismissWotNotifications", func() error { return err })()

	return libkb.DismissWotNotifications(mctx, arg.Voucher, arg.Vouchee)
}

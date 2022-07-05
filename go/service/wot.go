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

func (h *WebOfTrustHandler) WotVouch(ctx context.Context, arg keybase1.WotVouchArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "WOT")
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace(fmt.Sprintf("WotVouch(%v,%v)", arg.Username, arg.GuiID), &err)()

	// This wotVouch RPC does not run Identify.
	// Because it relies on the previous Identify used to display the vouchee's profile.
	// We must guard against a malicious server doing a last-minute reset of the vouchee to trick the voucher
	// client into signing a statement for the post-reset user.
	// This is guarded by locking on to the eldestSeqno from the guiID of the Identify on the profile screen.
	state, err := mctx.G().Identify3State.Get(arg.GuiID)
	if err != nil {
		return err
	}
	if state == nil {
		return fmt.Errorf("missing identify state")
	}
	outcome := state.Outcome()
	if outcome == nil {
		return fmt.Errorf("missing identify outcome")
	}
	if outcome.Username != libkb.NewNormalizedUsername(arg.Username) {
		return fmt.Errorf("username mismatch: %v != %v", outcome.Username, libkb.NewNormalizedUsername(arg.Username))
	}
	mctx.Debug("vouchee from identify outcome: uid:%v eldestSeqno:%v", outcome.UID, outcome.EldestSeqno)

	return engine.RunEngine2(mctx, engine.NewWotVouch(h.G(), &engine.WotVouchArg{
		Vouchee: keybase1.UserVersion{
			Uid:         outcome.UID,
			EldestSeqno: outcome.EldestSeqno,
		},
		Confidence: arg.Confidence,
		VouchText:  arg.VouchText,
	}))
}

func (h *WebOfTrustHandler) WotVouchCLI(ctx context.Context, arg keybase1.WotVouchCLIArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "WOT")
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace(fmt.Sprintf("WotVouchCLI(%v)", arg.Assertion), &err)()

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
		mctx.Debug("WotVouch TrackBreaks: %+v", idRes.TrackBreaks)
		return libkb.TrackingBrokeError{}
	}
	return engine.RunEngine2(mctx, engine.NewWotVouch(h.G(), &engine.WotVouchArg{
		Vouchee:    idRes.Upk.Current.ToUserVersion(),
		Confidence: arg.Confidence,
		VouchText:  arg.VouchText,
	}))
}

func (h *WebOfTrustHandler) WotFetchVouches(ctx context.Context, arg keybase1.WotFetchVouchesArg) (res []keybase1.WotVouch, err error) {
	ctx = libkb.WithLogTag(ctx, "WOT")
	mctx := libkb.NewMetaContext(ctx, h.G())
	return libkb.FetchWotVouches(mctx, libkb.FetchWotVouchesArg{Vouchee: arg.Vouchee, Voucher: arg.Voucher})
}

func (h *WebOfTrustHandler) WotReact(ctx context.Context, arg keybase1.WotReactArg) error {
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

	earg := &engine.WotReactArg{
		Voucher:  expectedVoucher,
		Proof:    reactingVouch.VouchProof,
		Reaction: arg.Reaction,
	}
	eng := engine.NewWotReact(h.G(), earg)
	return engine.RunEngine2(mctx, eng)
}

func (h *WebOfTrustHandler) DismissWotNotifications(ctx context.Context, arg keybase1.DismissWotNotificationsArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace("DismissWotNotifications", &err)()

	return libkb.DismissWotNotifications(mctx, arg.Voucher, arg.Vouchee)
}

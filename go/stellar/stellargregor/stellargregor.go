package stellargregor

import (
	"context"
	"fmt"
	"strings"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
)

type Handler struct {
	libkb.Contextified
	walletState *stellar.WalletState
}

var _ libkb.GregorInBandMessageHandler = (*Handler)(nil)

func New(g *libkb.GlobalContext, walletState *stellar.WalletState) *Handler {
	return &Handler{
		Contextified: libkb.NewContextified(g),
		walletState:  walletState,
	}
}

func (h *Handler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("WGR")
	switch category {
	case stellar1.PushAutoClaim:
		return true, h.autoClaim(mctx, cli, category, item)
	case stellar1.PushPaymentStatus:
		return true, h.paymentStatus(mctx, cli, category, item)
	case stellar1.PushPaymentNotification:
		return true, h.paymentNotification(mctx, cli, category, item)
	case stellar1.PushRequestStatus:
		return true, h.requestStatus(mctx, cli, category, item)
	default:
		if strings.HasPrefix(category, "stellar.") {
			return false, fmt.Errorf("unknown handler category: %q", category)
		}
		return false, nil
	}
}

func (h *Handler) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	return false, nil
}

func (h *Handler) IsAlive() bool {
	return true
}

func (h *Handler) Name() string {
	return "stellarHandler"
}

// The server is telling the client to claim relay payments.
func (h *Handler) autoClaim(mctx libkb.MetaContext, cli gregor1.IncomingInterface, category string, item gregor.Item) error {
	mctx.CDebugf("%v: %v received", h.Name(), category)
	mctx.G().GetStellar().KickAutoClaimRunner(mctx, item.Metadata().MsgID())
	return nil
}

func (h *Handler) paymentStatus(mctx libkb.MetaContext, cli gregor1.IncomingInterface, category string, item gregor.Item) error {
	mctx.CDebugf("%v: %v received IBM, ignoring it", h.Name(), category)

	// We will locally dismiss for now so that each client only plays them once:
	if err := h.G().GregorDismisser.LocalDismissItem(mctx.Ctx(), item.Metadata().MsgID()); err != nil {
		h.G().Log.CDebugf(mctx.Ctx(), "failed to local dismiss payment_status: %s", err)
	}

	return nil
}

func (h *Handler) paymentNotification(mctx libkb.MetaContext, cli gregor1.IncomingInterface, category string, item gregor.Item) error {
	mctx.CDebugf("%s: %s received IBM, ignoring it", h.Name(), category)

	// We will locally dismiss for now so that each client only plays them once:
	if err := h.G().GregorDismisser.LocalDismissItem(mctx.Ctx(), item.Metadata().MsgID()); err != nil {
		h.G().Log.CDebugf(mctx.Ctx(), "failed to local dismiss payment_notification: %s", err)
	}

	return nil
}

func (h *Handler) requestStatus(mctx libkb.MetaContext, cli gregor1.IncomingInterface, category string, item gregor.Item) error {
	mctx.CDebugf("%v: %v received IBM, ignoring it", h.Name(), category)

	// We will locally dismiss for now so that each client only plays them once:
	if err := h.G().GregorDismisser.LocalDismissItem(mctx.Ctx(), item.Metadata().MsgID()); err != nil {
		h.G().Log.CDebugf(mctx.Ctx(), "failed to local dismiss request_status: %s", err)
	}

	return nil
}

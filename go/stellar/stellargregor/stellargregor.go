package stellargregor

import (
	"context"
	"encoding/json"
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
	mctx := libkb.NewMetaContextBackground(h.G()).WithLogTag("WAIBM")
	switch category {
	case stellar1.PushAutoClaim:
		go h.autoClaim(mctx, cli, category, item)
		return true, nil
	case stellar1.PushPaymentStatus:
		go h.paymentStatus(mctx, cli, category, item)
		return true, nil
	case stellar1.PushPaymentNotification:
		go h.paymentNotification(mctx, cli, category, item)
		return true, nil
	case stellar1.PushRequestStatus:
		go h.requestStatus(mctx, cli, category, item)
		return true, nil
	case stellar1.PushAccountChange:
		go h.accountChange(mctx, cli, category, item)
		return true, nil
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
func (h *Handler) autoClaim(mctx libkb.MetaContext, cli gregor1.IncomingInterface, category string, item gregor.Item) {
	mctx.Debug("%v: %v received", h.Name(), category)
	mctx.G().GetStellar().KickAutoClaimRunner(mctx, item.Metadata().MsgID())
}

type accountChangeMsg struct {
	AccountID string `json:"account_id"`
	Reason    string `json:"reason"`
}

func (h *Handler) accountChange(mctx libkb.MetaContext, cli gregor1.IncomingInterface, category string, item gregor.Item) {
	mctx.Debug("%v: %v received", h.Name(), category)

	if item.Body() == nil {
		mctx.Debug("stellar handler for account_change: nil message body")
		return
	}
	var msgBody accountChangeMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msgBody); err != nil {
		mctx.Debug("stellar handler for account_change: json.Unmarshal error: %s", err)
		return
	}

	if msgBody.AccountID != "" {
		if err := h.walletState.Refresh(mctx, stellar1.AccountID(msgBody.AccountID), "accountChange gregor"); err != nil {
			mctx.Debug("failed to Refresh wallet state: %s", err)
		}
		account, err := stellar.WalletAccount(mctx, h.walletState, stellar1.AccountID(msgBody.AccountID))
		if err == nil {
			h.G().NotifyRouter.HandleWalletAccountDetailsUpdate(mctx.Ctx(), stellar1.AccountID(msgBody.AccountID), account)
		} else {
			mctx.Debug("failed to HandleWalletAccountDetailsUpdate: %s", err)
		}
	} else {
		if err := h.walletState.RefreshAll(mctx, "accountChange gregor"); err != nil {
			mctx.Debug("failed to RefreshAll wallet state: %s", err)
		}
		accounts, err := stellar.AllWalletAccounts(mctx, h.walletState)
		if err == nil {
			h.G().NotifyRouter.HandleWalletAccountsUpdate(mctx.Ctx(), accounts)
		} else {
			mctx.Debug("failed to HandleWalletAccountsUpdate: %s", err)
		}
	}

	// We will locally dismiss for now so that each client only plays them once:
	if err := h.G().GregorState.LocalDismissItem(mctx.Ctx(), item.Metadata().MsgID()); err != nil {
		mctx.Debug("failed to local dismiss account_change: %s", err)
	}
}

// paymentStatus is an old IBM and shouldn't happen anymore
func (h *Handler) paymentStatus(mctx libkb.MetaContext, cli gregor1.IncomingInterface, category string, item gregor.Item) {
	mctx.Debug("%v: %v received IBM, ignoring it", h.Name(), category)

	// We will locally dismiss for now so that each client only plays them once:
	if err := h.G().GregorState.LocalDismissItem(mctx.Ctx(), item.Metadata().MsgID()); err != nil {
		h.G().Log.CDebugf(mctx.Ctx(), "failed to local dismiss payment_status: %s", err)
	}
}

// paymentNotification is an old IBM and shouldn't happen anymore
func (h *Handler) paymentNotification(mctx libkb.MetaContext, cli gregor1.IncomingInterface, category string, item gregor.Item) {
	mctx.Debug("%s: %s received IBM, ignoring it", h.Name(), category)

	// We will locally dismiss for now so that each client only plays them once:
	if err := h.G().GregorState.LocalDismissItem(mctx.Ctx(), item.Metadata().MsgID()); err != nil {
		h.G().Log.CDebugf(mctx.Ctx(), "failed to local dismiss payment_notification: %s", err)
	}
}

// requestStatus is an old IBM and shouldn't happen anymore
func (h *Handler) requestStatus(mctx libkb.MetaContext, cli gregor1.IncomingInterface, category string, item gregor.Item) {
	mctx.Debug("%v: %v received IBM, ignoring it", h.Name(), category)

	// We will locally dismiss for now so that each client only plays them once:
	if err := h.G().GregorState.LocalDismissItem(mctx.Ctx(), item.Metadata().MsgID()); err != nil {
		h.G().Log.CDebugf(mctx.Ctx(), "failed to local dismiss request_status: %s", err)
	}
}

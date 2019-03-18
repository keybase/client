package service

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

const accountResetHandlerName = "accountResetHandlerName"

type accountResetGregorHandler struct {
	libkb.Contextified
}

var _ libkb.GregorInBandMessageHandler = (*accountResetGregorHandler)(nil)

func newAccountResetGregorHandler(g *libkb.GlobalContext) *accountResetGregorHandler {
	return &accountResetGregorHandler{
		Contextified: libkb.NewContextified(g),
	}
}

func (h *accountResetGregorHandler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	// Cancel other outstanding notifications so we only display the latest (or
	// nothing if we have cancelled the process).
	mctx := libkb.NewMetaContext(ctx, h.G())
	switch category {
	case "accountReset.notify",
		"accountReset.cancel":
		err := h.dismissOldAccountResetNotifications(mctx, cli, item)
		return true, err
	default:
		if strings.HasPrefix(category, "accountReset.") {
			return false, fmt.Errorf("unknown accountReset category: %q", category)
		}
		return false, nil
	}
}

func (h *accountResetGregorHandler) Dismiss(ctx context.Context, cli gregor1.IncomingInterface,
	category string, item gregor.Item) (bool, error) {
	return false, nil
}

func (h *accountResetGregorHandler) IsAlive() bool {
	return true
}

func (h *accountResetGregorHandler) Name() string {
	return accountResetHandlerName
}

func (h *accountResetGregorHandler) dismissOldAccountResetNotifications(mctx libkb.MetaContext,
	cli gregor1.IncomingInterface, newItem gregor.Item) (err error) {
	execeptedMsgID := newItem.Metadata().MsgID().String()
	state, err := h.G().GregorState.State(mctx.Ctx())
	if err != nil {
		return err
	}

	items, err := state.Items()
	if err != nil {
		return err
	}
	for _, item := range items {
		category := item.Category().String()
		switch category {
		case "accountReset.cancel", "accountReset.notify":
		default:
			continue
		}
		itemID := item.Metadata().MsgID()
		if itemID.String() != execeptedMsgID {
			mctx.Debug("dismissing accountReset notification %s for %s", category, itemID)
			if err := h.G().GregorState.DismissItem(mctx.Ctx(), cli, itemID); err != nil {

				mctx.Debug("unable to dismiss %s for %s, %v", category, itemID, err)
			}
		}
	}
	return nil
}

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
	"github.com/keybase/client/go/stellar/remote"
)

type Handler struct {
	libkb.Contextified
	remoter remote.Remoter
}

var _ libkb.GregorInBandMessageHandler = (*Handler)(nil)

func New(g *libkb.GlobalContext, remoter remote.Remoter) *Handler {
	return &Handler{
		Contextified: libkb.NewContextified(g),
		remoter:      remoter,
	}
}

func (h *Handler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("WGR")
	switch category {
	case "stellar.autoclaim":
		return true, h.autoClaim(mctx, cli, category, item)
	case "stellar.payment_status":
		return true, h.paymentStatus(mctx, cli, category, item)
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
	defer h.G().GregorDismisser.DismissItem(mctx.Ctx(), cli, item.Metadata().MsgID())
	mctx.CDebugf("%v: %v received", h.Name(), category)
	var msg stellar1.PaymentStatusMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		mctx.CDebugf("error unmarshaling %s item: %s", category, err)
		return err
	}
	mctx.CDebugf("%s unmarshaled: %+v", category, msg)

	return nil
}

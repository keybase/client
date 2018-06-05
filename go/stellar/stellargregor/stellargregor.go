package stellargregor

import (
	"context"
	"fmt"
	"strings"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/stellar/remote"
)

type handler struct {
	libkb.Contextified
	remoter remote.Remoter
}

var _ libkb.GregorInBandMessageHandler = (*handler)(nil)

func New(g *libkb.GlobalContext, remoter remote.Remoter) *handler {
	return &handler{
		Contextified: libkb.NewContextified(g),
		remoter:      remoter,
	}
}

func (h *handler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("WGR")
	switch category {
	case "stellar.autoclaim":
		return true, h.autoClaim(mctx, cli, category, item)
	default:
		if strings.HasPrefix(category, "stellar.") {
			return false, fmt.Errorf("unknown handler category: %q", category)
		}
		return false, nil
	}
}

func (h *handler) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	return false, nil
}

func (h *handler) IsAlive() bool {
	return true
}

func (h *handler) Name() string {
	return "stellarHandler"
}

// The server is telling the client to claim relay payments.
func (h *handler) autoClaim(mctx libkb.MetaContext, cli gregor1.IncomingInterface, category string, item gregor.Item) error {
	mctx.CDebugf("%v: %v received", h.Name(), category)
	mctx.G().GetStellar().KickAutoClaimRunner(mctx, item.Metadata().MsgID())
	return nil
}

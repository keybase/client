// Handlers for ephemeral-related gregor messages

package service

import (
	"encoding/hex"
	"fmt"
	"github.com/keybase/client/go/protocol/keybase1"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
)

const kbfsFavoritesHandlerName = "kbfsFavoritesHandler"

type kbfsFavoritesHandler struct {
	libkb.Contextified

	// handled stores the set of requests that this client has processed so
	// that we don't handle a request more than once.
	handled map[string]bool
}

var _ libkb.GregorInBandMessageHandler = (*ekHandler)(nil)

func newKBFSFavoritesHandler(g *libkb.GlobalContext) *kbfsFavoritesHandler {
	return &kbfsFavoritesHandler{
		Contextified: libkb.NewContextified(g),
		handled:      make(map[string]bool),
	}
}

func (r *kbfsFavoritesHandler) Create(ctx context.Context, cli gregor1.IncomingInterface,
	category string, item gregor.Item) (bool, error) {
	switch category {
	case "kbfs.favorites":
		return true, r.favoritesChanged(ctx, cli, item)
	default:
		if strings.HasPrefix(category, "kbfs.") {
			return false, fmt.Errorf("unknown KBFS category: %q", category)
		}
		return false, nil
	}
}

func (r *kbfsFavoritesHandler) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	return false, nil
}

func (r *kbfsFavoritesHandler) IsAlive() bool {
	return true
}

func (r *kbfsFavoritesHandler) Name() string {
	return kbfsFavoritesHandlerName
}

func (r *kbfsFavoritesHandler) favoritesChanged(ctx context.Context,
	cli gregor1.IncomingInterface,
	item gregor.Item) error {
	r.G().Log.CDebugf(ctx, "kbfsFavoritesHandler: kbfs."+
		"favorites received")

	// check whether we have seen this message ID before.
	// We can't dismiss the message even if we've handled it because we want
	// all clients to see it.
	msgID := item.Metadata().MsgID().String()
	if _, ok := r.handled[msgID]; ok {
		// we have already handled this message
		return nil
	}
	r.handled[msgID] = true

	kbUID, err := keybase1.UIDFromString(hex.EncodeToString(
		item.Metadata().UID().Bytes()))
	if err != nil {
		return err
	}
	r.Contextified.G().NotifyRouter.HandleFavoritesChanged(kbUID)
	return nil
}

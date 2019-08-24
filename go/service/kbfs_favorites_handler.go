// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Handlers for KBFS-favorites-related gregor messages

package service

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/protocol/keybase1"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
)

const kbfsFavoritesHandlerName = "kbfsFavoritesHandler"

type kbfsFavoritesHandler struct {
	libkb.Contextified
}

var _ libkb.GregorInBandMessageHandler = (*kbfsFavoritesHandler)(nil)

func newKBFSFavoritesHandler(g *libkb.GlobalContext) *kbfsFavoritesHandler {
	return &kbfsFavoritesHandler{
		Contextified: libkb.NewContextified(g),
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

	// We will locally dismiss for now so that each client only plays them once:
	if err := r.G().GregorState.LocalDismissItem(ctx, item.Metadata().MsgID()); err != nil {
		r.G().Log.CDebugf(ctx,
			"failed to locally dismiss favoritesChanged notification: %s", err)
	}

	kbUID := keybase1.UID(item.Metadata().UID().String())
	r.Contextified.G().NotifyRouter.HandleFavoritesChanged(kbUID)
	return nil
}

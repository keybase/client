// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// FavoriteHandler implements the keybase1.Favorite protocol
type FavoriteHandler struct {
	*BaseHandler
	libkb.Contextified
}

// NewFavoriteHandler creates a FavoriteHandler with the xp
// protocol.
func NewFavoriteHandler(xp rpc.Transporter, g *libkb.GlobalContext) *FavoriteHandler {
	return &FavoriteHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

// FavoriteAdd handles the favoriteAdd RPC.
func (h *FavoriteHandler) FavoriteAdd(ctx context.Context, arg keybase1.FavoriteAddArg) error {
	eng := engine.NewFavoriteAdd(h.G(), &arg)
	uis := libkb.UIs{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

// FavoriteIgnore handles the favoriteIgnore RPC.
func (h *FavoriteHandler) FavoriteIgnore(ctx context.Context, arg keybase1.FavoriteIgnoreArg) error {
	eng := engine.NewFavoriteIgnore(h.G(), &arg)
	m := libkb.NewMetaContext(ctx, h.G())
	return engine.RunEngine2(m, eng)
}

// FavoriteList handles the favoriteList RPC.
func (h *FavoriteHandler) GetFavorites(ctx context.Context, sessionID int) (keybase1.FavoritesResult, error) {
	eng := engine.NewFavoriteList(h.G())
	m := libkb.NewMetaContext(ctx, h.G())
	if err := engine.RunEngine2(m, eng); err != nil {
		return keybase1.FavoritesResult{}, err
	}
	return eng.Result(), nil
}

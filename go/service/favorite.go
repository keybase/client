// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

// FavoriteAdd handles the favoriteAdd RPC.
func (h *FavoriteHandler) FavoriteAdd(_ context.Context, arg keybase1.FavoriteAddArg) error {
	eng := engine.NewFavoriteAdd(&arg, h.G())
	ctx := &engine.Context{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
	}
	return engine.RunEngine(eng, ctx)
}

// FavoriteIgnore handles the favoriteIgnore RPC.
func (h *FavoriteHandler) FavoriteIgnore(_ context.Context, arg keybase1.FavoriteIgnoreArg) error {
	eng := engine.NewFavoriteIgnore(&arg, h.G())
	ctx := &engine.Context{}
	return engine.RunEngine(eng, ctx)
}

// FavoriteList handles the favoriteList RPC.
func (h *FavoriteHandler) GetFavorites(_ context.Context, sessionID int) (keybase1.FavoritesResult, error) {
	eng := engine.NewFavoriteList(h.G())
	ctx := &engine.Context{}
	if err := engine.RunEngine(eng, ctx); err != nil {
		return keybase1.FavoritesResult{}, err
	}
	return eng.Result(), nil
}

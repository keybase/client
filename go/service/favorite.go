// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

// FavoriteHandler implements the keybase1.Favorite protocol
type FavoriteHandler struct {
	libkb.Contextified
	ui FavoriteUI
}

// FavoriteRPCHandler implements the keybase1.Favorite protocol
type FavoriteRPCHandler struct {
	*BaseHandler
	*FavoriteHandler
}

// FavoriteUI resolves UI for favorite requests
type FavoriteUI interface {
	NewRemoteIdentifyUI(sessionID int, g *libkb.GlobalContext) *RemoteIdentifyUI
}

// NewFavoriteHandler constructs a FavoriteHandler
func NewFavoriteHandler(g *libkb.GlobalContext, ui FavoriteUI) *FavoriteHandler {
	return &FavoriteHandler{
		Contextified: libkb.NewContextified(g),
		ui:           ui,
	}
}

// NewFavoriteRPCHandler creates a FavoriteHandler with the xp
// protocol.
func NewFavoriteRPCHandler(xp rpc.Transporter, g *libkb.GlobalContext) *FavoriteRPCHandler {
	handler := NewBaseHandler(xp)
	return &FavoriteRPCHandler{
		BaseHandler:     handler,
		FavoriteHandler: NewFavoriteHandler(g, handler),
	}
}

// FavoriteAdd handles the favoriteAdd RPC.
func (h *FavoriteHandler) FavoriteAdd(_ context.Context, arg keybase1.FavoriteAddArg) error {
	eng := engine.NewFavoriteAdd(&arg, h.G())
	ctx := &engine.Context{
		IdentifyUI: h.ui.NewRemoteIdentifyUI(arg.SessionID, h.G()),
	}
	return engine.RunEngine(eng, ctx)
}

// FavoriteIgnore handles the favoriteIgnore RPC.
func (h *FavoriteHandler) FavoriteIgnore(_ context.Context, arg keybase1.FavoriteIgnoreArg) error {
	eng := engine.NewFavoriteIgnore(&arg, h.G())
	ctx := &engine.Context{}
	return engine.RunEngine(eng, ctx)
}

// GetFavorites handles the favoriteList RPC.
func (h *FavoriteHandler) GetFavorites(_ context.Context, sessionID int) (keybase1.FavoritesResult, error) {
	eng := engine.NewFavoriteList(h.G())
	ctx := &engine.Context{}
	if err := engine.RunEngine(eng, ctx); err != nil {
		return keybase1.FavoritesResult{}, err
	}
	return eng.Result(), nil
}

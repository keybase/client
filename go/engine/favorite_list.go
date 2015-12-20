// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// FavoriteList is an engine.
type FavoriteList struct {
	libkb.Contextified
	result FavoritesResult
}

// NewFavoriteList creates a FavoriteList engine.
func NewFavoriteList(g *libkb.GlobalContext) *FavoriteList {
	return &FavoriteList{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *FavoriteList) Name() string {
	return "FavoriteList"
}

// GetPrereqs returns the engine prereqs.
func (e *FavoriteList) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *FavoriteList) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *FavoriteList) SubConsumers() []libkb.UIConsumer {
	return nil
}

type FavoritesResult struct {
	Status    libkb.AppStatus   `json:"status"`
	Favorites []keybase1.Folder `json:"favorites"`
	Ignored   []keybase1.Folder `json:"ignored"`
}

func (f *FavoritesResult) GetAppStatus() *libkb.AppStatus {
	return &f.Status
}

// Run starts the engine.
func (e *FavoriteList) Run(ctx *Context) error {
	return e.G().API.GetDecode(libkb.APIArg{
		Endpoint:    "kbfs/favorite/list",
		NeedSession: true,
		Args:        libkb.HTTPArgs{},
	}, &e.result)
}

// Favorites returns the list of favorites that Run generated.
func (e *FavoriteList) Favorites() []keybase1.Folder {
	return e.result.Favorites
}

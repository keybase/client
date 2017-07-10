// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// FavoriteList is an engine.
type FavoriteList struct {
	libkb.Contextified
	result FavoritesAPIResult
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

type FavoritesAPIResult struct {
	Status    libkb.AppStatus   `json:"status"`
	Favorites []keybase1.Folder `json:"favorites"`
	Ignored   []keybase1.Folder `json:"ignored"`
	New       []keybase1.Folder `json:"new"`
}

func (f *FavoritesAPIResult) GetAppStatus() *libkb.AppStatus {
	return &f.Status
}

// Run starts the engine.
func (e *FavoriteList) Run(ctx *Context) error {
	arg := libkb.NewRetryAPIArg("kbfs/favorite/list")
	arg.SessionType = libkb.APISessionTypeREQUIRED

	// return e.G().API.GetDecode(arg, &e.result)
	err := e.G().API.GetDecode(arg, &e.result)
	e.G().Log.Errorf("Got result %#v", e.result)
	return err
}

// Favorites returns the list of favorites that Run generated.
func (e *FavoriteList) Result() keybase1.FavoritesResult {
	return keybase1.FavoritesResult{
		FavoriteFolders: e.result.Favorites,
		IgnoredFolders:  e.result.Ignored,
		NewFolders:      e.result.New,
	}
}

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// FavoriteList is an engine.
type FavoriteList struct {
	libkb.Contextified
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
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *FavoriteList) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *FavoriteList) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *FavoriteList) Run(ctx *Context) error {
	return nil
}

// Favorites returns the list of favorites that Run generated.
func (e *FavoriteList) Favorites() []keybase1.Folder {
	return e.G().FavoriteCache.List()
}

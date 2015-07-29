package engine

import (
	"github.com/keybase/client/go/libkb"
)

// FavoriteAdd is an engine.
type FavoriteAdd struct {
	libkb.Contextified
}

// NewFavoriteAdd creates a FavoriteAdd engine.
func NewFavoriteAdd(g *libkb.GlobalContext) *FavoriteAdd {
	return &FavoriteAdd{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *FavoriteAdd) Name() string {
	return "FavoriteAdd"
}

// GetPrereqs returns the engine prereqs.
func (e *FavoriteAdd) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *FavoriteAdd) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *FavoriteAdd) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *FavoriteAdd) Run(ctx *Context) error {
	return nil
}

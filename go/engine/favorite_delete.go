package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// FavoriteDelete is an engine.
type FavoriteDelete struct {
	arg *keybase1.FavoriteDeleteArg
	libkb.Contextified
}

// NewFavoriteDelete creates a FavoriteDelete engine.
func NewFavoriteDelete(arg *keybase1.FavoriteDeleteArg, g *libkb.GlobalContext) *FavoriteDelete {
	return &FavoriteDelete{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *FavoriteDelete) Name() string {
	return "FavoriteDelete"
}

// GetPrereqs returns the engine prereqs.
func (e *FavoriteDelete) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *FavoriteDelete) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *FavoriteDelete) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *FavoriteDelete) Run(ctx *Context) error {
	if e.arg == nil {
		return fmt.Errorf("FavoriteDelete arg is nil")
	}
	e.G().FavoriteCache.Delete(e.arg.Folder)
	return nil
}

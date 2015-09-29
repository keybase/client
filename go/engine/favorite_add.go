package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// FavoriteAdd is an engine.
type FavoriteAdd struct {
	arg *keybase1.FavoriteAddArg
	libkb.Contextified
}

// NewFavoriteAdd creates a FavoriteAdd engine.
func NewFavoriteAdd(arg *keybase1.FavoriteAddArg, g *libkb.GlobalContext) *FavoriteAdd {
	return &FavoriteAdd{
		arg:          arg,
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
	if e.arg == nil {
		return fmt.Errorf("FavoriteAdd arg is nil")
	}
	e.G().FavoriteCache.Add(e.arg.Folder)
	return nil
}

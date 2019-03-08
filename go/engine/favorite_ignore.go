// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// FavoriteIgnore is an engine.
type FavoriteIgnore struct {
	arg *keybase1.FavoriteIgnoreArg
	libkb.Contextified
}

// NewFavoriteIgnore creates a FavoriteIgnore engine.
func NewFavoriteIgnore(g *libkb.GlobalContext, arg *keybase1.FavoriteIgnoreArg) *FavoriteIgnore {
	return &FavoriteIgnore{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *FavoriteIgnore) Name() string {
	return "FavoriteIgnore"
}

// GetPrereqs returns the engine prereqs.
func (e *FavoriteIgnore) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *FavoriteIgnore) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *FavoriteIgnore) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *FavoriteIgnore) Run(m libkb.MetaContext) error {
	if e.arg == nil {
		return fmt.Errorf("FavoriteIgnore arg is nil")
	}
	_, err := m.G().API.Post(m, libkb.APIArg{
		Endpoint:    "kbfs/favorite/add",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"tlf_name":    libkb.S{Val: e.arg.Folder.Name},
			"folder_type": libkb.I{Val: int(e.arg.Folder.FolderType)},
			"status":      libkb.S{Val: "ignored"},
		},
	})
	return err
}

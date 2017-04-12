// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// HasServerKeys is an engine.
type HasServerKeys struct {
	libkb.Contextified
	res keybase1.HasServerKeysRes
}

// NewHasServerKeys creates a HasServerKeys engine.
func NewHasServerKeys(arg *keybase1.HasServerKeysArg, g *libkb.GlobalContext) *HasServerKeys {
	return &HasServerKeys{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *HasServerKeys) Name() string {
	return "HasServerKeys"
}

// Prereqs returns the engine prereqs.
func (e *HasServerKeys) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *HasServerKeys) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *HasServerKeys) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *HasServerKeys) Run(ctx *Context) error {
	apiRes, err := e.G().API.Get(libkb.APIArg{
		Endpoint:    "key/fetch_private",
		Args:        libkb.HTTPArgs{},
		SessionType: libkb.APISessionTypeREQUIRED,
	})
	if err != nil {
		return err
	}
	var spk libkb.ServerPrivateKeys
	if err = apiRes.Body.UnmarshalAgain(&spk); err != nil {
		e.G().Log.Debug("error unmarshaling ServerPrivateKeys")
		return err
	}
	e.res.HasServerKeys = len(spk.PrivateKeys) > 0
	e.G().Log.Debug("HasServerKeys: %v", e.res.HasServerKeys)

	return nil
}

func (e *HasServerKeys) GetResult() keybase1.HasServerKeysRes {
	return e.res
}

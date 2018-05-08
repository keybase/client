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
func NewHasServerKeys(g *libkb.GlobalContext) *HasServerKeys {
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
		Device: true,
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
func (e *HasServerKeys) Run(m libkb.MetaContext) error {
	apiRes, err := m.G().API.Get(libkb.APIArg{
		Endpoint:    "key/fetch_private",
		Args:        libkb.HTTPArgs{},
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  m.Ctx(),
	})
	if err != nil {
		return err
	}
	var spk libkb.ServerPrivateKeys
	if err = apiRes.Body.UnmarshalAgain(&spk); err != nil {
		m.CDebugf("error unmarshaling ServerPrivateKeys")
		return err
	}
	e.res.HasServerKeys = len(spk.PrivateKeys) > 0
	m.CDebugf("HasServerKeys: %v", e.res.HasServerKeys)

	return nil
}

func (e *HasServerKeys) GetResult() keybase1.HasServerKeysRes {
	return e.res
}

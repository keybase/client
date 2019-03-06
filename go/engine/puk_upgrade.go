// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// PerUserKeyUpgrade creates a per-user-key for the active user
// if they do not already have one.
// It adds a per-user-key link to the sigchain and adds the key to the local keyring.
package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// PerUserKeyUpgrade is an engine.
type PerUserKeyUpgrade struct {
	libkb.Contextified
	args      *PerUserKeyUpgradeArgs
	DidNewKey bool
}

type PerUserKeyUpgradeArgs struct{}

// NewPerUserKeyUpgrade creates a PerUserKeyUpgrade engine.
func NewPerUserKeyUpgrade(g *libkb.GlobalContext, args *PerUserKeyUpgradeArgs) *PerUserKeyUpgrade {
	return &PerUserKeyUpgrade{
		args:         args,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PerUserKeyUpgrade) Name() string {
	return "PerUserKeyUpgrade"
}

// GetPrereqs returns the engine prereqs.
func (e *PerUserKeyUpgrade) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *PerUserKeyUpgrade) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PerUserKeyUpgrade) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{&PerUserKeyRoll{}}
}

// Run starts the engine.
func (e *PerUserKeyUpgrade) Run(m libkb.MetaContext) (err error) {
	defer m.Trace("PerUserKeyUpgrade", func() error { return err })()
	return e.inner(m)
}

func (e *PerUserKeyUpgrade) inner(m libkb.MetaContext) error {
	if !m.G().Env.GetUpgradePerUserKey() {
		return fmt.Errorf("per-user-key upgrade is disabled")
	}

	m.Debug("PerUserKeyUpgrade load self")

	uid := m.G().GetMyUID()
	if uid.IsNil() {
		return libkb.NoUIDError{}
	}

	m.Debug("PerUserKeyUpgrade upgrading: %d", uid)

	loadArg := libkb.NewLoadUserArgWithMetaContext(m).
		WithUID(uid).
		WithSelf(true).
		WithPublicKeyOptional()
	upak, me, err := m.G().GetUPAKLoader().LoadV2(loadArg)
	if err != nil {
		return err
	}
	// `me` could be nil. Use the upak for quick checks and then pass maybe-nil `me` to the next engine.

	m.Debug("PerUserKeyUpgrade check for key")
	if len(upak.Current.PerUserKeys) > 0 {
		m.Debug("PerUserKeyUpgrade already has per-user-key")
		e.DidNewKey = false
		return nil
	}
	m.Debug("PerUserKeyUpgrade has no per-user-key")

	// Make the key
	arg := &PerUserKeyRollArgs{
		Me: me,
	}
	eng := NewPerUserKeyRoll(m.G(), arg)
	err = RunEngine2(m, eng)
	e.DidNewKey = eng.DidNewKey

	return err
}

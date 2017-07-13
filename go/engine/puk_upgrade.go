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
		Session: true,
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
func (e *PerUserKeyUpgrade) Run(ctx *Context) (err error) {
	defer e.G().CTrace(ctx.GetNetContext(), "PerUserKeyUpgrade", func() error { return err })()
	return e.inner(ctx)
}

func (e *PerUserKeyUpgrade) inner(ctx *Context) error {
	if !e.G().Env.GetUpgradePerUserKey() {
		return fmt.Errorf("per-user-key upgrade is disabled")
	}

	e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpgrade load self")

	uid := e.G().GetMyUID()
	if uid.IsNil() {
		return libkb.NoUIDError{}
	}

	loadArg := libkb.NewLoadUserArgBase(e.G()).
		WithNetContext(ctx.GetNetContext()).
		WithUID(uid).
		WithSelf(true).
		WithPublicKeyOptional()
	upak, me, err := e.G().GetUPAKLoader().Load(*loadArg)
	if err != nil {
		return err
	}
	// `me` could be nil. Use the upak for quick checks and then fill `me`.

	e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpgrade check for key")
	if len(upak.Base.PerUserKeys) > 0 {
		e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpgrade already has per-user-key")
		e.DidNewKey = false
		return nil
	}
	e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpgrade has no per-user-key")

	// Make the key
	arg := &PerUserKeyRollArgs{
		Me: me,
	}
	eng := NewPerUserKeyRoll(e.G(), arg)
	err = RunEngine(eng, ctx)
	e.DidNewKey = eng.DidNewKey
	return err
}

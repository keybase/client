// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// PerUserKeyUpkeep rolls the user's per-user-key if the last PUK
// was added by a now-revoked device.
// Does not add a first per-user-key. Use PerUserKeyUpgrade for that.
// This engine makes up for the fact that after a self-deprovision
// the latest PUK for a user was generated on the very machine they
// wanted to deprovision.
// This will not notice if a device revoked another device but neglected
// to roll the PUK. No clients should do that.
package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// PerUserKeyUpkeep is an engine.
type PerUserKeyUpkeep struct {
	libkb.Contextified
	args       *PerUserKeyUpkeepArgs
	DidRollKey bool
}

type PerUserKeyUpkeepArgs struct{}

// NewPerUserKeyUpkeep creates a PerUserKeyUpkeep engine.
func NewPerUserKeyUpkeep(g *libkb.GlobalContext, args *PerUserKeyUpkeepArgs) *PerUserKeyUpkeep {
	return &PerUserKeyUpkeep{
		args:         args,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PerUserKeyUpkeep) Name() string {
	return "PerUserKeyUpkeep"
}

// GetPrereqs returns the engine prereqs.
func (e *PerUserKeyUpkeep) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *PerUserKeyUpkeep) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PerUserKeyUpkeep) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
func (e *PerUserKeyUpkeep) Run(ctx *Context) (err error) {
	defer e.G().CTrace(ctx.GetNetContext(), "PerUserKeyUpkeep", func() error { return err })()
	return e.inner(ctx)
}

func (e *PerUserKeyUpkeep) inner(ctx *Context) error {
	e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpkeep load self")

	uid := e.G().GetMyUID()
	if uid.IsNil() {
		return libkb.NoUIDError{}
	}

	loadArg := libkb.NewLoadUserArgBase(e.G()).
		WithNetContext(ctx.GetNetContext()).
		WithUID(uid).
		WithSelf(true).
		WithPublicKeyOptional()
	upak, me, err := e.G().GetUPAKLoader().LoadV2(*loadArg)
	if err != nil {
		return err
	}
	// `me` could be nil.

	var shouldRollKey bool
	shouldRollKey, err = e.shouldRollKey(ctx, uid, &upak.Current)
	if err != nil {
		return err
	}
	if !shouldRollKey {
		e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpkeep skipping")
		return nil
	}

	// Roll the key
	e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpkeep rolling key")
	arg := &PerUserKeyRollArgs{
		Me: me,
	}
	eng := NewPerUserKeyRoll(e.G(), arg)
	err = RunEngine(eng, ctx)
	e.DidRollKey = eng.DidNewKey
	return err
}

// Whether we should roll the per-user-key.
func (e *PerUserKeyUpkeep) shouldRollKey(ctx *Context, uid keybase1.UID, upak *keybase1.UserPlusKeysV2) (bool, error) {

	if len(upak.PerUserKeys) == 0 {
		e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpkeep has no per-user-key")
		return false, nil
	}
	e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpkeep has %v per-user-keys", len(upak.PerUserKeys))

	lastPuk := upak.PerUserKeys[len(upak.PerUserKeys)-1]
	if !lastPuk.SignedByKID.IsValid() {
		return false, errors.New("latest per-user-key had invalid signed-by KID")
	}
	e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpkeep last key signed by KID: %v", lastPuk.SignedByKID.String())
	return !e.keyIsActiveSibkey(ctx, lastPuk.SignedByKID, upak), nil
}

func (e *PerUserKeyUpkeep) keyIsActiveSibkey(ctx *Context, kid keybase1.KID, upak *keybase1.UserPlusKeysV2) bool {
	for _, dkey := range upak.DeviceKeys {
		active := dkey.Base.Revocation == nil
		if active && dkey.Base.IsSibkey && dkey.Base.Kid.Equal(kid) {
			return true
		}
	}
	return false
}

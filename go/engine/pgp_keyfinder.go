// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// PGPKeyfinder is an engine to find PGP Keys for users (loaded by
// assertions), possibly tracking them if necessary.
type PGPKeyfinder struct {
	arg    *PGPKeyfinderArg
	uplus  []*UserPlusKeys
	runerr error
	libkb.Contextified
}

type PGPKeyfinderArg struct {
	Usernames []string // must be keybase usernames
}

// NewPGPKeyfinder creates a PGPKeyfinder engine.
func NewPGPKeyfinder(arg *PGPKeyfinderArg, g *libkb.GlobalContext) *PGPKeyfinder {
	return &PGPKeyfinder{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PGPKeyfinder) Name() string {
	return "PGPKeyfinder"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPKeyfinder) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PGPKeyfinder) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPKeyfinder) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
func (e *PGPKeyfinder) Run(ctx *Context) error {
	e.loadUsers(ctx)
	e.loadKeys(ctx)
	return e.runerr
}

// UsersPlusKeys returns the users found while running the engine,
// plus their pgp keys.
func (e *PGPKeyfinder) UsersPlusKeys() []*UserPlusKeys {
	return e.uplus
}

// don't identify or track, just load the users
func (e *PGPKeyfinder) loadUsers(ctx *Context) {
	if e.runerr != nil {
		return
	}

	for _, u := range e.arg.Usernames {
		arg := libkb.NewLoadUserByNameArg(e.G(), u)
		user, err := libkb.LoadUser(arg)
		if err != nil {
			e.runerr = err
			return
		}
		e.addUser(user, false)
	}

}

func (e *PGPKeyfinder) loadKeys(ctx *Context) {
	if e.runerr != nil {
		return
	}

	// get the pgp keys for all the users
	for _, x := range e.uplus {
		keys := x.User.GetActivePGPKeys(true)
		if len(keys) == 0 {
			e.runerr = libkb.NoPGPEncryptionKeyError{
				User:         x.User.GetName(),
				HasDeviceKey: x.User.HasEncryptionSubkey(),
			}
			return
		}
		x.Keys = keys
	}
}

type UserPlusKeys struct {
	User      *libkb.User
	IsTracked bool
	Keys      []*libkb.PGPKeyBundle
}

func (e *PGPKeyfinder) addUser(user *libkb.User, tracked bool) {
	e.uplus = append(e.uplus, &UserPlusKeys{User: user, IsTracked: tracked})
}

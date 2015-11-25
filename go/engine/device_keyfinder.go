// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
)

// DeviceKeyfinder is an engine to find device keys for users (loaded by
// assertions), possibly tracking them if necessary.
type DeviceKeyfinder struct {
	arg      *DeviceKeyfinderArg
	uplus    []*UserPlusDeviceKeys
	loggedIn bool
	libkb.Contextified
}

type DeviceKeyfinderArg struct {
	Me           *libkb.User
	Users        []string
	SkipTrack    bool
	TrackOptions keybase1.TrackOptions
}

// NewDeviceKeyfinder creates a DeviceKeyfinder engine.
func NewDeviceKeyfinder(arg *DeviceKeyfinderArg, g *libkb.GlobalContext) *DeviceKeyfinder {
	return &DeviceKeyfinder{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *DeviceKeyfinder) Name() string {
	return "DeviceKeyfinder"
}

// GetPrereqs returns the engine prereqs.
func (e *DeviceKeyfinder) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *DeviceKeyfinder) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *DeviceKeyfinder) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&TrackEngine{},
		&Identify{},
	}
}

// Run starts the engine.
func (e *DeviceKeyfinder) Run(ctx *Context) error {
	err := e.setup(ctx)
	if err != nil {
		return err
	}

	err = e.verifyUsers(ctx)
	if err != nil {
		return err
	}

	err = e.loadKeys(ctx)
	if err != nil {
		return err
	}

	return nil
}

// UsersPlusDeviceKeys returns the users found while running the engine,
// plus their device keys.
func (e *DeviceKeyfinder) UsersPlusDeviceKeys() []*UserPlusDeviceKeys {
	return e.uplus
}

func (e *DeviceKeyfinder) setup(ctx *Context) error {
	ok, err := IsLoggedIn(e, ctx)
	if err != nil {
		return err
	}

	e.loggedIn = ok
	return nil
}

func (e *DeviceKeyfinder) verifyUsers(ctx *Context) error {
	if e.loggedIn && !e.arg.SkipTrack {
		return e.trackUsers(ctx)
	}
	return e.identifyUsers(ctx)
}

func (e *DeviceKeyfinder) trackUsers(ctx *Context) error {
	// need to track any users we aren't tracking
	for _, u := range e.arg.Users {
		if err := e.trackUser(ctx, u); err != nil {
			return err
		}
	}

	return nil
}

func (e *DeviceKeyfinder) identifyUsers(ctx *Context) error {
	// need to identify all the users
	for _, u := range e.arg.Users {
		if err := e.identifyUser(ctx, u); err != nil {
			return err
		}
	}

	return nil
}

func (e *DeviceKeyfinder) loadKeys(ctx *Context) error {
	// get the device keys for all the users
	for _, x := range e.uplus {
		var keys []keybase1.PublicKey
		ckf := x.User.GetComputedKeyFamily()
		if ckf != nil {
			keys = ckf.ExportDeviceKeys()
		}

		if len(keys) == 0 {
			return fmt.Errorf("User %s doesn't have a device key", x.User.GetName())
		}
		x.Keys = keys
	}

	return nil
}

func (e *DeviceKeyfinder) trackUser(ctx *Context, username string) error {
	e.G().Log.Debug("tracking user %q", username)
	arg := &TrackEngineArg{
		Me:            e.arg.Me,
		UserAssertion: username,
		Options:       e.arg.TrackOptions,
	}
	eng := NewTrackEngine(arg, e.G())
	err := RunEngine(eng, ctx)
	// ignore self track errors
	if _, ok := err.(libkb.SelfTrackError); ok {
		e.addUser(e.arg.Me, false)
		return nil
	}
	if err != nil {
		return err
	}
	e.addUser(eng.User(), true)
	return nil
}

// PC: maybe we need to bring the TrackUI back for the
// context...so that this one can use an IdentifyUI and trackUser
// can use a TrackUI...
func (e *DeviceKeyfinder) identifyUser(ctx *Context, user string) error {
	arg := NewIdentifyArg(user, false, false)
	eng := NewIdentify(arg, e.G())
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}
	e.addUser(eng.User(), false)
	return nil
}

type UserPlusDeviceKeys struct {
	User      *libkb.User
	IsTracked bool
	Keys      []keybase1.PublicKey
}

func (e *DeviceKeyfinder) addUser(user *libkb.User, tracked bool) {
	e.uplus = append(e.uplus, &UserPlusDeviceKeys{User: user, IsTracked: tracked})
}

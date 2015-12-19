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
	libkb.Contextified
	arg     DeviceKeyfinderArg
	userMap map[keybase1.UID]UserPlusDeviceKeys
}

type DeviceKeyfinderArg struct {
	Users []string
	// If nil, no tracking is done.
	Me           *libkb.User
	TrackOptions keybase1.TrackOptions
}

type UserPlusDeviceKeys struct {
	User      *libkb.User
	Index     int
	IsTracked bool
	Keys      []keybase1.PublicKey
}

// NewDeviceKeyfinder creates a DeviceKeyfinder engine.
func NewDeviceKeyfinder(g *libkb.GlobalContext, arg DeviceKeyfinderArg) *DeviceKeyfinder {
	return &DeviceKeyfinder{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
		userMap:      make(map[keybase1.UID]UserPlusDeviceKeys),
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
	err := e.verifyUsers(ctx)
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
func (e *DeviceKeyfinder) UsersPlusDeviceKeys() map[keybase1.UID]UserPlusDeviceKeys {
	return e.userMap
}

func (e *DeviceKeyfinder) verifyUsers(ctx *Context) error {
	for _, u := range e.arg.Users {
		if e.arg.Me != nil {
			if err := e.trackUser(ctx, u); err != nil {
				return err
			}
		} else {
			if err := e.identifyUser(ctx, u); err != nil {
				return err
			}
		}
	}

	return nil
}

func (e *DeviceKeyfinder) loadKeys(ctx *Context) error {
	// get the device keys for all the users
	for uid, uwk := range e.userMap {
		var keys []keybase1.PublicKey
		ckf := uwk.User.GetComputedKeyFamily()
		if ckf != nil {
			keys = ckf.ExportDeviceKeys()
		}

		if len(keys) == 0 {
			return fmt.Errorf("User %s doesn't have a device key", uwk.User.GetName())
		}
		uwk.Keys = keys
		e.userMap[uid] = uwk
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

func (e *DeviceKeyfinder) hasUser(user *libkb.User) bool {
	_, ok := e.userMap[user.GetUID()]
	return ok
}

func (e *DeviceKeyfinder) addUser(user *libkb.User, tracked bool) {
	if e.hasUser(user) {
		return
	}

	index := len(e.userMap)
	e.userMap[user.GetUID()] = UserPlusDeviceKeys{
		User:      user,
		Index:     index,
		IsTracked: tracked,
	}
}

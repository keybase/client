// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// DeviceKeyfinder is an engine to find device keys for users (loaded by
// assertions), possibly tracking them if necessary.
type DeviceKeyfinder struct {
	libkb.Contextified
	arg     DeviceKeyfinderArg
	userMap map[keybase1.UID](*keybase1.UserPlusKeysV2)
}

type DeviceKeyfinderArg struct {
	Users           []string
	NeedEncryptKeys bool
	NeedVerifyKeys  bool
	Self            *libkb.User
}

// NewDeviceKeyfinder creates a DeviceKeyfinder engine.
func NewDeviceKeyfinder(g *libkb.GlobalContext, arg DeviceKeyfinderArg) *DeviceKeyfinder {
	return &DeviceKeyfinder{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
		userMap:      make(map[keybase1.UID](*keybase1.UserPlusKeysV2)),
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
		&ResolveThenIdentify2{},
	}
}

// Run starts the engine.
func (e *DeviceKeyfinder) Run(m libkb.MetaContext) (err error) {
	defer m.CTrace("DeviceKeyfinder#Run", func() error { return err })()

	err = e.identifyUsers(m)
	if err != nil {
		return err
	}
	return nil
}

// UsersPlusDeviceKeys returns the users found while running the engine,
// plus their device keys.
func (e *DeviceKeyfinder) UsersPlusKeysV2() map[keybase1.UID](*keybase1.UserPlusKeysV2) {
	return e.userMap
}

func (e *DeviceKeyfinder) identifyUsers(m libkb.MetaContext) error {
	for _, u := range e.arg.Users {
		if err := e.identifyUser(m, u); err != nil {
			return err
		}
	}
	return nil
}

func (e *DeviceKeyfinder) identifyUser(m libkb.MetaContext, user string) error {
	arg := keybase1.Identify2Arg{
		UserAssertion: user,
		Reason: keybase1.IdentifyReason{
			Type: keybase1.IdentifyReasonType_ENCRYPT,
		},
		AlwaysBlock:      true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CLI,
	}
	eng := NewResolveThenIdentify2(m.G(), &arg)
	if err := RunEngine2(m, eng); err != nil {
		return libkb.IdentifyFailedError{Assertion: user, Reason: err.Error()}
	}
	res, err := eng.Result()
	if err != nil {
		return err
	}
	return e.addUser(m, res)
}

func (e *DeviceKeyfinder) hasUser(m libkb.MetaContext, upk *keybase1.UserPlusKeysV2) bool {
	_, ok := e.userMap[upk.GetUID()]
	return ok
}

func (e *DeviceKeyfinder) filterKeys(m libkb.MetaContext, upk *keybase1.UserPlusKeysV2) error {
	keys := make(map[keybase1.KID]keybase1.PublicKeyV2NaCl)
	for kid, key := range upk.DeviceKeys {
		if e.arg.NeedVerifyKeys && !libkb.KIDIsDeviceVerify(kid) {
			continue
		}
		if e.arg.NeedEncryptKeys && !libkb.KIDIsDeviceEncrypt(kid) {
			continue
		}
		keys[kid] = key
	}
	if len(keys) == 0 {
		return libkb.NoNaClEncryptionKeyError{User: upk.Username, HasPGPKey: len(upk.PGPKeys) > 0}
	}
	upk.DeviceKeys = keys
	return nil
}

func (e *DeviceKeyfinder) addUser(m libkb.MetaContext, ir *keybase1.Identify2ResUPK2) error {

	if ir == nil {
		return fmt.Errorf("Null result from Identify2")
	}
	upk := &ir.Upk.Current

	if e.hasUser(m, upk) {
		return nil
	}

	if e.arg.Self != nil && e.arg.Self.GetUID().Equal(upk.GetUID()) {
		m.CDebugf("skipping self in DevicekeyFinder (uid=%s)", upk.GetUID())
		return nil
	}

	if err := e.filterKeys(m, upk); err != nil {
		return err
	}

	e.userMap[upk.GetUID()] = upk

	return nil
}

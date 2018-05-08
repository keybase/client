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
	userMap map[keybase1.UID](*keybase1.UserPlusKeys)
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
		userMap:      make(map[keybase1.UID](*keybase1.UserPlusKeys)),
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
func (e *DeviceKeyfinder) UsersPlusKeys() map[keybase1.UID](*keybase1.UserPlusKeys) {
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
	return e.addUser(m, eng.Result())
}

func (e *DeviceKeyfinder) hasUser(m libkb.MetaContext, upk *keybase1.UserPlusKeys) bool {
	_, ok := e.userMap[upk.Uid]
	return ok
}

func (e *DeviceKeyfinder) filterKeys(m libkb.MetaContext, upk *keybase1.UserPlusKeys) error {
	var keys []keybase1.PublicKey
	for _, key := range upk.DeviceKeys {
		if len(key.PGPFingerprint) != 0 {
			// this shouldn't happen
			continue
		}
		if e.arg.NeedVerifyKeys && !libkb.KIDIsDeviceVerify(key.KID) {
			continue
		}
		if e.arg.NeedEncryptKeys && !libkb.KIDIsDeviceEncrypt(key.KID) {
			continue
		}
		keys = append(keys, key)
	}
	if len(keys) == 0 {
		return libkb.NoNaClEncryptionKeyError{User: upk.Username, HasPGPKey: upk.PGPKeyCount > 0}
	}
	upk.DeviceKeys = keys
	return nil
}

func (e *DeviceKeyfinder) addUser(m libkb.MetaContext, ir *keybase1.Identify2Res) error {

	if ir == nil {
		return fmt.Errorf("Null result from Identify2")
	}
	upk := &ir.Upk

	if e.hasUser(m, upk) {
		return nil
	}

	if e.arg.Self != nil && e.arg.Self.GetUID().Equal(upk.Uid) {
		m.CDebugf("skipping self in DevicekeyFinder (uid=%s)", upk.Uid)
		return nil
	}

	if err := e.filterKeys(m, upk); err != nil {
		return err
	}

	e.userMap[upk.Uid] = upk

	return nil
}

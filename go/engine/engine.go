// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"runtime/debug"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type Prereqs = libkb.EnginePrereqs
type Engine2 = libkb.Engine2

type UIDelegateWanter interface {
	WantDelegate(libkb.UIKind) bool
}

func requiresUI(c libkb.UIConsumer, kind libkb.UIKind) bool {
	for _, ui := range c.RequiredUIs() {
		if ui == kind {
			return true
		}
	}
	for _, sub := range c.SubConsumers() {
		if requiresUI(sub, kind) {
			return true
		}
	}
	return false
}

// isLoggedInWithUIDAndError conveys if the user is in a logged-in state or not.
// If this function returns `true`, it's because the user is logged in,
// is on a provisioned device, and has an unlocked device key, If this
// function returns `false`, it's because either no one has ever logged onto
// this device, or someone has, and then clicked `logout`. If the return
// value is `false`, and `err` is `nil`, then the service is in one of
// those expected "logged out" states.  If the return value is `false`
// and `err` is non-`nil`, then something went wrong, and the app is in some
// sort of unexpected state. If `ret` is `true`, then `uid` will convey
// which user is logged in.
//
// Under the hood, IsLoggedIn is going through the BootstrapActiveDevice
// flow and therefore will try its best to unlocked locked keys if it can
// without user interaction.
func isLoggedInWithUIDAndError(m libkb.MetaContext) (ret bool, uid keybase1.UID, err error) {
	ret, uid, err = libkb.BootstrapActiveDeviceWithMetaContext(m)
	return ret, uid, err
}

func isLoggedIn(m libkb.MetaContext) (ret bool, uid keybase1.UID) {
	ret, uid, _ = libkb.BootstrapActiveDeviceWithMetaContext(m)
	return ret, uid
}

func isLoggedInAs(m libkb.MetaContext, uid keybase1.UID) (ret bool) {
	ret, err := libkb.BootstrapActiveDeviceWithMetaContextAndAssertUID(m, uid)
	if err != nil {
		m.Debug("isLoggedAs error: %s", err)
	}
	return ret
}

func assertLoggedIn(m libkb.MetaContext, which string) (err error) {
	ret, err := isLoggedInWithError(m)
	if err != nil {
		return err
	}
	if !ret {
		return libkb.NewLoginRequiredError(which)
	}
	return nil
}

func isLoggedInWithError(m libkb.MetaContext) (ret bool, err error) {
	ret, _, err = isLoggedInWithUIDAndError(m)
	return ret, err
}

func runPrereqs(m libkb.MetaContext, e Engine2) error {
	prq := e.Prereqs()

	if prq.TemporarySession {
		if !m.HasAnySession() {
			return libkb.NewLoginRequiredError("need either a temporary session or a device")
		}
	}

	if prq.Device {
		ok, err := isLoggedInWithError(m)
		if err != nil {
			return err
		}
		if !ok {
			return libkb.DeviceRequiredError{}
		}
	}

	return nil

}

func RunEngine2(m libkb.MetaContext, e Engine2) (err error) {
	m = m.WithLogTag("ENG")
	defer m.Trace(fmt.Sprintf("RunEngine(%s)", e.Name()), func() error { return err })()

	if m, err = delegateUIs(m, e); err != nil {
		return err
	}
	if err = check(m, e); err != nil {
		return err
	}
	if err = runPrereqs(m, e); err != nil {
		return err
	}

	err = e.Run(m)
	return err
}

func getIdentifyUI3or1(m libkb.MetaContext) (libkb.IdentifyUI, error) {
	uir := m.G().UIRouter
	ret, err := uir.GetIdentify3UIAdapter(m)
	if ret != nil && err == nil {
		return ret, err
	}
	return uir.GetIdentifyUI()
}

func delegateUIs(m libkb.MetaContext, e Engine2) (libkb.MetaContext, error) {
	if m.G().UIRouter == nil {
		return m, nil
	}

	// currently, only doing this for SecretUI, but in future,
	// perhaps should iterate over all registered UIs in UIRouter.
	if requiresUI(e, libkb.SecretUIKind) {
		sessionID := m.UIs().SessionID
		if ui, err := m.G().UIRouter.GetSecretUI(sessionID); err != nil {
			return m, err
		} else if ui != nil {
			m.Debug("using delegated secret UI for engine %q (session id = %d)", e.Name(), sessionID)
			m = m.WithSecretUI(ui)
		}
	}

	if wantsDelegateUI(e, libkb.IdentifyUIKind) {
		m.Debug("IdentifyUI wanted for engine %q", e.Name())
		ui, err := getIdentifyUI3or1(m)
		if err != nil {
			return m, err
		}
		if ui != nil {
			m.Debug("using delegated identify UI for engine %q", e.Name())
			m = m.WithDelegatedIdentifyUI(ui)
		}
	}
	return m, nil
}

func wantsDelegateUI(e Engine2, kind libkb.UIKind) bool {
	if !requiresUI(e, kind) {
		return false
	}
	if i, ok := e.(UIDelegateWanter); ok {
		return i.WantDelegate(kind)
	}
	return false
}

func check(m libkb.MetaContext, c libkb.UIConsumer) error {
	if err := checkUI(m, c); err != nil {
		return err
	}

	for _, sub := range c.SubConsumers() {
		if err := check(m, sub); err != nil {
			if _, ok := err.(CheckError); ok {
				return err
			}
			return CheckError{fmt.Sprintf("%s: %s", sub.Name(), err)}
		}
	}

	return nil
}

func checkUI(m libkb.MetaContext, c libkb.UIConsumer) error {
	for _, ui := range c.RequiredUIs() {
		if !m.UIs().HasUI(ui) {
			return CheckError{fmt.Sprintf("%s: requires ui %q\n\n%s", c.Name(), ui, string(debug.Stack()))}
		}
	}
	return nil
}

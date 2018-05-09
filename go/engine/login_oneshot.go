// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// "Oneshot login" is a login that works only once, say in an ephemeral
// context like a docker image. Bootstrap such a session with a paperkey,
// but the existence of the login won't hit the user's sigchain.
type LoginOneshot struct {
	libkb.Contextified
	arg        keybase1.LoginOneshotArg
	upak       keybase1.UserPlusKeysV2
	sigKey     libkb.GenericKey
	encKey     libkb.NaclDHKeyPair
	deviceID   keybase1.DeviceID
	deviceName string
}

func NewLoginOneshot(g *libkb.GlobalContext, arg keybase1.LoginOneshotArg) *LoginOneshot {
	return &LoginOneshot{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

func (e *LoginOneshot) Name() string {
	return "LoginOneshot"
}

func (e *LoginOneshot) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *LoginOneshot) RequiredUIs() []libkb.UIKind      { return []libkb.UIKind{} }
func (e *LoginOneshot) SubConsumers() []libkb.UIConsumer { return []libkb.UIConsumer{} }

func (e *LoginOneshot) loadUser(m libkb.MetaContext) (err error) {
	defer m.CTrace("LoginOneshot#loadUser", func() error { return err })()
	arg := libkb.NewLoadUserArgWithMetaContext(m).WithName(e.arg.Username)
	var upak *keybase1.UserPlusKeysV2AllIncarnations
	upak, _, err = m.G().GetUPAKLoader().LoadV2(arg)
	if err != nil {
		return err
	}
	e.upak = upak.Current
	return nil
}

func (e *LoginOneshot) loadKey(m libkb.MetaContext) (err error) {
	defer m.CTrace("LoginOneshot#loadKey", func() error { return err })()
	arg := PaperKeyGenArg{
		Passphrase: libkb.NewPaperKeyPhrase(e.arg.PaperKey),
		SkipPush:   true,
		UID:        e.upak.GetUID(),
	}
	eng := NewPaperKeyGen(e.G(), &arg)
	err = RunEngine2(m, eng)
	if err != nil {
		return err
	}
	e.sigKey = eng.SigKey()
	e.encKey = eng.EncKey()
	device := e.upak.FindDeviceKey(e.sigKey.GetKID())
	if device == nil {
		return libkb.NewNoDeviceError("no device found for paper key")
	}
	if device.Base.Revocation != nil {
		return libkb.NewKeyRevokedError(e.sigKey.GetKID().String())
	}
	e.deviceID = device.DeviceID
	e.deviceName = device.DeviceDescription
	return nil
}

func (e *LoginOneshot) checkLogin(m libkb.MetaContext) (err error) {
	defer m.CTrace("LoginOneshot#checkLogin", func() error { return err })()
	arg := libkb.NewRetryAPIArg("sesscheck")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	_, err = m.G().API.Get(arg)
	return err
}

func (e *LoginOneshot) makeLoginChanges(m libkb.MetaContext) (err error) {
	defer m.CTrace("LoginOneshot#makeLoginChanges", func() error { return err })()
	var gerr error
	err = m.G().LoginState().Account(func(a *libkb.Account) {
		gerr = m.ActiveDevice().Set(m.WithLoginContext(a), e.upak.GetUID(), e.deviceID, e.sigKey, e.encKey, e.deviceName)
	}, "LoginOneshot#makeLoginChanges")
	if err != nil {
		return err
	}
	err = gerr
	if err != nil {
		return err
	}
	uc := libkb.NewOneshotUserConfig(e.upak.GetUID(), libkb.NewNormalizedUsername(e.upak.GetName()), nil, e.deviceID)
	m.G().Env.GetConfigWriter().SetUserConfig(uc, false)

	return nil
}

func (e *LoginOneshot) commitLoginChanges(m libkb.MetaContext) (err error) {
	defer m.CTrace("LoginOneshot#commitLoginChanges", func() error { return err })()
	m.G().NotifyRouter.HandleLogin(e.arg.Username)
	m.G().CallLoginHooks()
	return nil
}

func (e *LoginOneshot) rollbackLoginChanges(m libkb.MetaContext) (err error) {
	defer m.CTrace("LoginOneshot#rollbackLoginChanges", func() error { return err })()
	var gerr error
	err = m.G().LoginState().Account(func(a *libkb.Account) {
		gerr = m.ActiveDevice().Clear(a)
	}, "LoginOneshot#rollbackLoginChanges")
	if err != nil {
		return err
	}
	err = gerr
	if err != nil {
		return err
	}
	m.G().Env.GetConfigWriter().SetUserConfig(nil, false)
	return nil
}

func (e *LoginOneshot) finish(m libkb.MetaContext) (err error) {
	defer m.CTrace("LoginOneshot#commit", func() error { return err })()

	err = e.makeLoginChanges(m)
	if err != nil {
		return err
	}
	err = e.checkLogin(m)
	if err == nil {
		err = e.commitLoginChanges(m)
	} else {
		e.rollbackLoginChanges(m)
	}
	return err
}

func (e *LoginOneshot) checkPreconditions(m libkb.MetaContext) (err error) {
	defer m.CTrace("LoginOneshot#checkPreconditions", func() error { return err })()
	if m.ActiveDevice().Valid() {
		return libkb.LoggedInError{}
	}
	return nil
}

func (e *LoginOneshot) Run(m libkb.MetaContext) (err error) {
	defer m.CTrace("LoginOneshot#run", func() error { return err })()

	if err = e.checkPreconditions(m); err != nil {
		return err
	}

	if err = e.loadUser(m); err != nil {
		return err
	}
	if err = e.loadKey(m); err != nil {
		return err
	}
	err = e.finish(m)
	return err
}

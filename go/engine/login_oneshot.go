// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// "Oneshot login" is a login that works only once, say in an ephemeral
// context like a docker image. Bootstrap such a session with a paperkey,
// but the existence of the login won't hit the user's sigchain.
type LoginOneshot struct {
	libkb.Contextified
	arg      keybase1.LoginOneshotArg
	upak     keybase1.UserPlusKeysV2
	sigKey   libkb.GenericKey
	encKey   libkb.NaclDHKeyPair
	deviceID keybase1.DeviceID
	deviceName string
}

func NewLoginOneshot(g *libkb.GlobalContext, arg keybase1.LoginOneshotArg) *LoginOneshot {
	return &LoginOneshot{
		Contextified : libkb.NewContextified(g),
		arg : arg,
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

func (e *LoginOneshot) loadUser(ctx context.Context) (err error) {
	defer e.G().CTrace(ctx, "LoginOneshot#loadUser", func() error { return err })()
	arg := libkb.NewLoadUserArgWithContext(ctx, e.G()).WithName(e.arg.Username)
	var upak *keybase1.UserPlusKeysV2AllIncarnations
	upak, _, err = e.G().GetUPAKLoader().LoadV2(arg)
	if err != nil {
		return err
	}
	e.upak = upak.Current
	return nil
}
func (e *LoginOneshot) loadKey(ectx *Context) (err error) {
	ctx := ectx.GetNetContext()
	defer e.G().CTrace(ctx, "LoginOneshot#loadKey", func() error { return err })()
	arg := PaperKeyGenArg{
		Passphrase: libkb.NewPaperKeyPhrase(e.arg.PaperKey),
		SkipPush:   true,
		UID:        e.upak.GetUID(),
	}
	eng := NewPaperKeyGen(&arg, e.G())
	err = RunEngine(eng, ectx)
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

func (e *LoginOneshot) checkLogin(ctx context.Context) (err error) {
	defer e.G().CTrace(ctx, "LoginOneshot#checkLogin", func() error { return err })()
	arg := libkb.NewRetryAPIArg("sesscheck")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	_, err = e.G().API.Get(arg)
	return err
}

func (e *LoginOneshot) makeLoginChanges(ctx context.Context) (err error) {
	defer e.G().CTrace(ctx, "LoginOneshot#makeLoginChanges", func() error { return err })()
	var gerr error
	err = e.G().LoginState().Account(func (a *libkb.Account) {
		gerr = e.G().ActiveDevice.Set(e.G(), a, e.upak.GetUID(), e.deviceID, e.sigKey, e.encKey, e.deviceName)
	}, "LoginOneshot#makeLoginChanges")
	if err != nil {
		return err
	}
	err = gerr
	if err != nil {
		return err
	}
	uc := libkb.NewOneshotUserConfig(e.upak.GetUID(), libkb.NewNormalizedUsername(e.upak.GetName()), nil, e.deviceID)
	e.G().Env.GetConfigWriter().SetUserConfig(uc, false)

	return nil
}

func (e *LoginOneshot) commitLoginChanges(ctx context.Context) (err error) {
	defer e.G().CTrace(ctx, "LoginOneshot#commitLoginChanges", func() error { return err })()
	e.G().NotifyRouter.HandleLogin(e.arg.Username)
	e.G().CallLoginHooks()
	return nil
}

func (e *LoginOneshot) rollbackLoginChanges(ctx context.Context) (err error) {
	defer e.G().CTrace(ctx, "LoginOneshot#rollbackLoginChanges", func() error { return err })()
	var gerr error
	err = e.G().LoginState().Account(func (a *libkb.Account) {
		gerr = e.G().ActiveDevice.Clear(a)
	}, "LoginOneshot#rollbackLoginChanges")
	if err != nil {
		return err
	}
	err = gerr
	if err != nil {
		return err
	}
	e.G().Env.GetConfigWriter().SetUserConfig(nil, false)
	return nil
}

func (e *LoginOneshot) finish(ctx context.Context) (err error) {
	defer e.G().CTrace(ctx, "LoginOneshot#commit", func() error { return err })()

	err = e.makeLoginChanges(ctx)
	if err != nil {
		return err
	}
	err = e.checkLogin(ctx)
	if err == nil {
		err = e.commitLoginChanges(ctx)
	} else {
		e.rollbackLoginChanges(ctx)
	}
	return err
}

func (e *LoginOneshot) checkPreconditions(ctx context.Context) (err error) {
	defer e.G().CTrace(ctx, "LoginOneshot#checkPreconditions", func() error { return err })()
	if e.G().ActiveDevice.Valid() {
		return libkb.LoggedInError{}
	}
	return nil
}

func (e *LoginOneshot) Run(ectx *Context) (err error) {
	ctx := ectx.GetNetContext()
	defer e.G().CTrace(ctx, "LoginOneshot#run", func() error { return err })()

	if err = e.checkPreconditions(ctx); err != nil {
		return err
	}

	if err = e.loadUser(ctx); err != nil {
		return err
	}
	if err = e.loadKey(ectx); err != nil {
		return err
	}
	err = e.finish(ctx)
	return err
}

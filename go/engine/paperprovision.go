// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type PaperProvisionEngine struct {
	libkb.Contextified
	Username       string
	DeviceName     string
	PaperKey       string
	result         error
	lks            *libkb.LKSec
	User           *libkb.User
	perUserKeyring *libkb.PerUserKeyring
}

func NewPaperProvisionEngine(g *libkb.GlobalContext, username, deviceName,
	paperKey string) *PaperProvisionEngine {
	return &PaperProvisionEngine{
		Contextified: libkb.NewContextified(g),
		Username:     username,
		DeviceName:   deviceName,
		PaperKey:     paperKey,
	}
}

func (e *PaperProvisionEngine) Name() string {
	return "PaperProvision"
}

func (e *PaperProvisionEngine) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *PaperProvisionEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.ProvisionUIKind,
		libkb.LogUIKind,
		libkb.SecretUIKind,
		libkb.LoginUIKind,
	}
}

func (e *PaperProvisionEngine) Run(m libkb.MetaContext) (err error) {
	defer m.CTrace("PaperProvisionEngine#Run", func() error { return err })()

	// clear out any existing session:
	e.G().Logout()

	// transaction around config file
	tx, err := e.G().Env.GetConfigWriter().BeginTransaction()
	if err != nil {
		return err
	}

	// From this point on, if there's an error, we abort the
	// transaction.
	defer func() {
		if tx != nil {
			tx.Abort()
		}
	}()

	// run the LoginLoadUser sub-engine to load a user
	ueng := newLoginLoadUser(e.G(), e.Username)
	if err = RunEngine2(m, ueng); err != nil {
		return err
	}

	// make sure the user isn't already provisioned (can
	// get here if usernameOrEmail is an email address
	// for an already provisioned on this device user).
	if ueng.User().HasCurrentDeviceInCurrentInstall() {
		return libkb.DeviceAlreadyProvisionedError{}
	}
	e.User = ueng.User()

	// Transform the paper key phrase into a key pair
	bkarg := &PaperKeyGenArg{
		Passphrase: libkb.PaperKeyPhrase(e.PaperKey),
		SkipPush:   true,
	}
	bkeng := NewPaperKeyGen(e.G(), bkarg)
	if err := RunEngine2(m, bkeng); err != nil {
		return err
	}

	kp := &keypair{sigKey: bkeng.SigKey(), encKey: bkeng.EncKey()}

	// Make sure the key matches the logged in user
	// use the KID to find the uid
	uid, err := e.uidByKID(kp.sigKey.GetKID())
	if err != nil {
		return err
	}

	if uid.NotEqual(e.User.GetUID()) {
		e.G().Log.Debug("paper key entered was for a different user")
		return fmt.Errorf("paper key valid, but for %s, not %s", uid, e.User.GetUID())
	}

	e.perUserKeyring, err = libkb.NewPerUserKeyring(e.G(), e.User.GetUID())
	if err != nil {
		return err
	}

	// Make new device keys and sign them with this paper key
	err = e.paper(m, kp)
	if err != nil {
		return err
	}

	// commit the config changes
	if err := tx.Commit(); err != nil {
		return err
	}

	// Zero out the TX so that we don't abort it in the defer()
	// exit.
	tx = nil

	e.sendNotification()
	return nil

}

// Copied from login_provision.go
func (e *PaperProvisionEngine) uidByKID(kid keybase1.KID) (keybase1.UID, error) {
	var nilUID keybase1.UID
	arg := libkb.APIArg{
		Endpoint:    "key/owner",
		SessionType: libkb.APISessionTypeNONE,
		Args:        libkb.HTTPArgs{"kid": libkb.S{Val: kid.String()}},
	}
	res, err := e.G().API.Get(arg)
	if err != nil {
		return nilUID, err
	}
	suid, err := res.Body.AtPath("uid").GetString()
	if err != nil {
		return nilUID, err
	}
	return keybase1.UIDFromString(suid)
}

// copied more or less from loginProvision.paper()
func (e *PaperProvisionEngine) paper(m libkb.MetaContext, kp *keypair) error {
	// After obtaining login session, this will be called before the login state is released.
	// It signs this new device with the paper key.
	var afterLogin = func(lctx libkb.LoginContext) error {
		m = m.WithLoginContext(lctx)

		// need lksec to store device keys locally
		if err := e.fetchLKS(m, kp.encKey); err != nil {
			return err
		}

		lctx.SetUnlockedPaperKey(kp.sigKey, kp.encKey)

		if err := e.makeDeviceKeysWithSigner(m, kp.sigKey); err != nil {
			return err
		}
		if err := lctx.LocalSession().SetDeviceProvisioned(e.G().Env.GetDeviceID()); err != nil {
			// not a fatal error, session will stay in memory
			m.CWarningf("error saving session file: %s", err)
		}
		return nil
	}

	// need a session to continue to provision, login with paper sigKey
	return e.G().LoginState().LoginWithKey(m, e.User, kp.sigKey, afterLogin)
}

func (e *PaperProvisionEngine) sendNotification() {
	e.G().NotifyRouter.HandleLogin(string(e.G().Env.GetUsername()))
}

func (e *PaperProvisionEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&loginLoadUser{},
	}
}

func (e *PaperProvisionEngine) Result() error {
	return e.result
}

// copied from loginProvision
func (e *PaperProvisionEngine) fetchLKS(m libkb.MetaContext, encKey libkb.GenericKey) error {
	gen, clientLKS, err := fetchLKS(m, encKey)
	if err != nil {
		return err
	}
	e.lks = libkb.NewLKSecWithClientHalf(clientLKS, gen, e.User.GetUID(), e.G())
	return nil
}

// copied from loginProvision
// makeDeviceKeysWithSigner creates device keys given a signing
// key.
func (e *PaperProvisionEngine) makeDeviceKeysWithSigner(m libkb.MetaContext, signer libkb.GenericKey) error {
	args, err := e.makeDeviceWrapArgs(m)
	if err != nil {
		return err
	}
	args.Signer = signer
	args.IsEldest = false // just to be explicit
	args.EldestKID = e.User.GetEldestKID()

	return e.makeDeviceKeys(m, args)
}

// copied from loginProvision
// makeDeviceWrapArgs creates a base set of args for DeviceWrap.
// It ensures that LKSec is created.  It also gets a new device
// name for this device.
func (e *PaperProvisionEngine) makeDeviceWrapArgs(m libkb.MetaContext) (*DeviceWrapArgs, error) {
	if err := e.ensureLKSec(m); err != nil {
		return nil, err
	}

	return &DeviceWrapArgs{
		Me:             e.User,
		DeviceName:     e.DeviceName,
		DeviceType:     "desktop",
		Lks:            e.lks,
		PerUserKeyring: e.perUserKeyring,
	}, nil
}

// copied from loginProvision
// makeDeviceKeys uses DeviceWrap to generate device keys.
func (e *PaperProvisionEngine) makeDeviceKeys(m libkb.MetaContext, args *DeviceWrapArgs) error {
	eng := NewDeviceWrap(m.G(), args)
	return RunEngine2(m, eng)
}

// copied from loginProvision
// ensureLKSec ensures we have LKSec for saving device keys.
func (e *PaperProvisionEngine) ensureLKSec(m libkb.MetaContext) error {
	if e.lks != nil {
		return nil
	}

	pps, err := e.ppStream(m)
	if err != nil {
		return err
	}

	e.lks = libkb.NewLKSec(pps, e.User.GetUID(), e.G())
	return nil
}

// copied from loginProvision
// ppStream gets the passphrase stream from the cache
func (e *PaperProvisionEngine) ppStream(m libkb.MetaContext) (*libkb.PassphraseStream, error) {
	if m.LoginContext() == nil {
		return nil, errors.New("loginProvision: ppStream() -> nil ctx.LoginContext")
	}
	cached := m.LoginContext().PassphraseStreamCache()
	if cached == nil {
		return nil, errors.New("loginProvision: ppStream() -> nil PassphraseStreamCache")
	}
	return cached.PassphraseStream(), nil
}

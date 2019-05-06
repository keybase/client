// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
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

	deviceWrapEng *DeviceWrap
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
	defer m.Trace("PaperProvisionEngine#Run", func() error { return err })()

	// clear out any existing session:
	e.G().Logout(m.Ctx())

	m = m.WithNewProvisionalLoginContext()

	// From this point on, if there's an error, we abort the
	// transaction.
	defer func() {
		if err == nil {
			m = m.CommitProvisionalLogin()
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

	keys := bkeng.DeviceWithKeys()

	// Make sure the key matches the logged in user
	// use the KID to find the uid
	uid, err := keys.Populate(m)
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
	if err = e.paper(m, keys); err != nil {
		return err
	}

	// Finish provisoning by calling SwitchConfigAndActiveDevice. we
	// can't undo that, so do not error out after that.
	if err := e.deviceWrapEng.SwitchConfigAndActiveDevice(m); err != nil {
		return err
	}

	e.sendNotification(m)
	return nil

}

// copied more or less from loginProvision.paper()
func (e *PaperProvisionEngine) paper(m libkb.MetaContext, keys *libkb.DeviceWithKeys) error {
	// After obtaining login session, this will be called before the login state is released.
	// It signs this new device with the paper key.
	u := e.User
	nn := u.GetNormalizedName()
	uv := u.ToUserVersion()

	// Set the active device to be a special paper key active device, which keeps
	// a cached copy around for DeviceKeyGen, which requires it to be in memory.
	// It also will establish a NIST so that API calls can proceed on behalf of the user.
	m = m.WithProvisioningKeyActiveDevice(keys, uv)
	m.LoginContext().SetUsernameUserVersion(nn, uv)

	// need lksec to store device keys locally
	if err := e.fetchLKS(m, keys.EncryptionKey()); err != nil {
		return err
	}

	if err := e.makeDeviceKeysWithSigner(m, keys.SigningKey()); err != nil {
		return err
	}

	// Cache the paper keys globally now that we're logged in
	m = m.WithGlobalActiveDevice()
	m.ActiveDevice().CacheProvisioningKey(m, keys)

	return nil
}

func (e *PaperProvisionEngine) sendNotification(m libkb.MetaContext) {
	e.G().NotifyRouter.HandleLogin(m.Ctx(), string(e.G().Env.GetUsername()))
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
	e.lks = libkb.NewLKSecWithClientHalf(clientLKS, gen, e.User.GetUID())
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

// Copied from loginProvision. makeDeviceKeys uses DeviceWrap to
// generate device keys and sets active device.
func (e *PaperProvisionEngine) makeDeviceKeys(m libkb.MetaContext, args *DeviceWrapArgs) error {
	e.deviceWrapEng = NewDeviceWrap(m.G(), args)
	return RunEngine2(m, e.deviceWrapEng)
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

	e.lks = libkb.NewLKSec(pps, e.User.GetUID())
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

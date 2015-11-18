// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// LoginProvision is an engine that will provision the current
// device.
type LoginProvision struct {
	libkb.Contextified
	arg          *LoginProvisionArg
	user         *libkb.User
	lks          *libkb.LKSec
	signingKey   libkb.GenericKey
	gpgCli       *libkb.GpgCLI
	username     string
	devname      string
	cleanupOnErr bool
}

type LoginProvisionArg struct {
	DeviceType string // desktop or mobile
	Username   string // optional
}

// NewLoginProvision creates a LoginProvision engine.  username
// is optional.
func NewLoginProvision(g *libkb.GlobalContext, arg *LoginProvisionArg) *LoginProvision {
	return &LoginProvision{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// Name is the unique engine name.
func (e *LoginProvision) Name() string {
	return "LoginProvision"
}

// GetPrereqs returns the engine prereqs.
func (e *LoginProvision) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *LoginProvision) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.ProvisionUIKind,
		libkb.LoginUIKind,
		libkb.SecretUIKind,
		libkb.GPGUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *LoginProvision) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DeviceWrap{},
		&PaperKeyPrimary{},
	}
}

// Run starts the engine.
func (e *LoginProvision) Run(ctx *Context) error {
	if err := e.checkArg(); err != nil {
		return err
	}

	method, err := e.chooseMethod(ctx)
	if err != nil {
		return err
	}

	if err := e.runMethod(ctx, method); err != nil {
		// cleanup state because there was an error:
		e.cleanup()
		return err
	}

	if err := e.ensurePaperKey(ctx); err != nil {
		return err
	}

	if err := e.displaySuccess(ctx); err != nil {
		return err
	}

	return nil
}

// device provisions this device with an existing device using the
// kex2 protocol.
func (e *LoginProvision) device(ctx *Context) error {
	provisionerType, err := ctx.ProvisionUI.ChooseDeviceType(context.TODO(), 0)
	if err != nil {
		return err
	}
	e.G().Log.Debug("provisioner device type: %v", provisionerType)

	// make a new secret:
	secret, err := libkb.NewKex2Secret()
	if err != nil {
		return err
	}
	e.G().Log.Debug("secret phrase: %s", secret.Phrase())

	// make a new device:
	deviceID, err := libkb.NewDeviceID()
	if err != nil {
		return err
	}
	device := &libkb.Device{
		ID:   deviceID,
		Type: e.arg.DeviceType,
	}

	// create provisionee engine
	provisionee := NewKex2Provisionee(e.G(), device, secret.Secret())

	var canceler func()

	// display secret and prompt for secret from X in a goroutine:
	go func() {
		sb := secret.Secret()
		arg := keybase1.DisplayAndPromptSecretArg{
			Secret:          sb[:],
			Phrase:          secret.Phrase(),
			OtherDeviceType: provisionerType,
		}
		var contxt context.Context
		contxt, canceler = context.WithCancel(context.Background())
		receivedSecret, err := ctx.ProvisionUI.DisplayAndPromptSecret(contxt, arg)
		if err != nil {
			// could cancel provisionee run here?
			e.G().Log.Warning("DisplayAndPromptSecret error: %s", err)
		} else if receivedSecret.Secret != nil && len(receivedSecret.Secret) > 0 {
			e.G().Log.Debug("received secret, adding to provisionee")
			var ks kex2.Secret
			copy(ks[:], receivedSecret.Secret)
			provisionee.AddSecret(ks)
		} else if len(receivedSecret.Phrase) > 0 {
			e.G().Log.Debug("received secret phrase, adding to provisionee")
			ks, err := libkb.NewKex2SecretFromPhrase(receivedSecret.Phrase)
			if err != nil {
				e.G().Log.Warning("DisplayAndPromptSecret error: %s", err)
			} else {
				provisionee.AddSecret(ks.Secret())
			}
		}
	}()

	defer func() {
		if canceler != nil {
			e.G().Log.Debug("canceling DisplayAndPromptSecret call")
			canceler()
		}
	}()

	f := func(lctx libkb.LoginContext) error {
		// run provisionee
		ctx.LoginContext = lctx
		return RunEngine(provisionee, ctx)
	}
	if err := e.G().LoginState().ExternalFunc(f, "LoginProvision.device - Run provisionee"); err != nil {
		return err
	}

	// need username, device name for ProvisionUI.ProvisioneeSuccess()
	e.username = provisionee.GetName()
	pdevice := provisionee.Device()
	if pdevice == nil {
		e.G().Log.Warning("nil provisionee device")
	} else if pdevice.Description == nil {
		e.G().Log.Warning("nil provisionee device description")
	} else {
		e.devname = *pdevice.Description
	}

	return nil
}

// gpg attempts to provision the device via a gpg key.
func (e *LoginProvision) gpg(ctx *Context) error {
	gpgKey, err := e.chooseGPGKey(ctx)
	if err != nil {
		return err
	}

	e.G().Log.Debug("using gpg key %s (%s)", gpgKey.GetFingerprintP(), gpgKey.GetKID())

	// After obtaining login session, this will be called before the login state is released.
	// It signs this new device with the gpg key in bundle.
	var afterLogin = func(lctx libkb.LoginContext) error {
		ctx.LoginContext = lctx
		if err := e.makeDeviceKeysWithSigner(ctx, gpgKey); err != nil {
			return err
		}
		if err := lctx.LocalSession().SetDeviceProvisioned(e.G().Env.GetDeviceID()); err != nil {
			// not a fatal error, session will stay in memory
			e.G().Log.Warning("error saving session file: %s", err)
		}
		return nil
	}

	// need a session to continue to provision
	return e.G().LoginState().LoginWithPrompt(e.user.GetName(), ctx.LoginUI, ctx.SecretUI, afterLogin)
}

// paper attempts to provision the device via a paper key.
func (e *LoginProvision) paper(ctx *Context) error {
	// get the paper key from the user
	kp, err := e.getPaperKey(ctx)
	if err != nil {
		return err
	}

	e.G().Log.Debug("paper signing key kid: %s", kp.sigKey.GetKID())
	e.G().Log.Debug("paper encryption key kid: %s", kp.encKey.GetKID())

	// use the KID to find (and load) the user
	user, err := e.loadUserByKID(kp.sigKey.GetKID())
	if err != nil {
		return err
	}
	e.user = user

	// found a paper key that can be used for signing
	e.G().Log.Debug("found paper key match for %s", e.user.GetName())

	// After obtaining login session, this will be called before the login state is released.
	// It signs this new device with the paper key.
	var afterLogin = func(lctx libkb.LoginContext) error {
		ctx.LoginContext = lctx

		// need lksec to store device keys locally
		if err := e.fetchLKS(ctx, kp.encKey); err != nil {
			return err
		}

		if err := e.makeDeviceKeysWithSigner(ctx, kp.sigKey); err != nil {
			return err
		}
		if err := lctx.LocalSession().SetDeviceProvisioned(e.G().Env.GetDeviceID()); err != nil {
			// not a fatal error, session will stay in memory
			e.G().Log.Warning("error saving session file: %s", err)
		}
		return nil
	}

	// need a session to continue to provision, login with paper sigKey
	return e.G().LoginState().LoginWithKey(ctx.LoginContext, e.user, kp.sigKey, afterLogin)
}

// passphrase attempts to provision the device via username and
// passphrase.  This will work if the user has no keys or only a
// synced pgp key.  Any other situations require different
// provisioning methods.
func (e *LoginProvision) passphrase(ctx *Context) error {
	// prompt for the username (if not provided) and load the user:
	var err error
	e.user, err = e.loadUser(ctx)
	if err != nil {
		return err
	}

	// check if they have any devices, pgp keys
	hasPGP := false
	ckf := e.user.GetComputedKeyFamily()
	if ckf != nil {
		hasPGP = len(ckf.GetActivePGPKeys(false)) > 0
	}

	if !e.user.GetEldestKID().IsNil() && hasPGP {
		// if they have any pgp keys in their family, there's a chance there is a synced
		// pgp key, so try provisioning with it.
		e.G().Log.Debug("user %q has a pgp key, trying to provision with it", e.user.GetName())
		if err := e.pgpProvision(ctx); err != nil {
			return err
		}
	} else if e.user.GetEldestKID().IsNil() {
		// they have no keys, so make the device keys the eldest keys:
		e.G().Log.Debug("user %q has no devices, no pgp keys", e.user.GetName())
		if err := e.addEldestDeviceKey(ctx); err != nil {
			return err
		}
	} else {
		// they have keys, but no pgp keys, so passphrase provisioning is impossible.
		return libkb.PassphraseProvisionImpossibleError{}
	}

	return nil

}

// pgpProvision attempts to provision with a synced pgp key.  It
// needs to get a session first to look for a synced pgp key.
func (e *LoginProvision) pgpProvision(ctx *Context) error {
	// After obtaining login session, this will be called before the login state is released.
	// It tries to get the pgp key and uses it to provision new device keys for this device.
	var afterLogin = func(lctx libkb.LoginContext) error {
		ctx.LoginContext = lctx
		signer, err := e.syncedPGPKey(ctx)
		if err != nil {
			return err
		}

		if err := e.makeDeviceKeysWithSigner(ctx, signer); err != nil {
			return err
		}
		if err := lctx.LocalSession().SetDeviceProvisioned(e.G().Env.GetDeviceID()); err != nil {
			// not a fatal error, session will stay in memory
			e.G().Log.Warning("error saving session file: %s", err)
		}
		return nil
	}

	// need a session to try to get synced private key
	return e.G().LoginState().LoginWithPrompt(e.user.GetName(), ctx.LoginUI, ctx.SecretUI, afterLogin)
}

// makeDeviceKeysWithSigner creates device keys given a signing
// key.
func (e *LoginProvision) makeDeviceKeysWithSigner(ctx *Context, signer libkb.GenericKey) error {
	args, err := e.makeDeviceWrapArgs(ctx)
	if err != nil {
		return err
	}
	args.Signer = signer
	args.IsEldest = false // just to be explicit
	args.EldestKID = e.user.GetEldestKID()

	return e.makeDeviceKeys(ctx, args)
}

// addEldestDeviceKey makes the device keys the eldest keys for
// e.user.
func (e *LoginProvision) addEldestDeviceKey(ctx *Context) error {
	args, err := e.makeDeviceWrapArgs(ctx)
	if err != nil {
		return err
	}
	args.IsEldest = true

	if err := e.makeDeviceKeys(ctx, args); err != nil {
		return err
	}

	// save provisioned device id in the session
	return e.setSessionDeviceID(e.G().Env.GetDeviceID())
}

// paperKey generates a primary paper key for the user.
func (e *LoginProvision) paperKey(ctx *Context) error {
	args := &PaperKeyPrimaryArgs{
		SigningKey: e.signingKey,
		Me:         e.user,
	}
	eng := NewPaperKeyPrimary(e.G(), args)
	return RunEngine(eng, ctx)
}

// makeDeviceWrapArgs creates a base set of args for DeviceWrap.
// It ensures that LKSec is created.  It also gets a new device
// name for this device.
func (e *LoginProvision) makeDeviceWrapArgs(ctx *Context) (*DeviceWrapArgs, error) {
	if err := e.ensureLKSec(ctx); err != nil {
		return nil, err
	}

	devname, err := e.deviceName(ctx)
	if err != nil {
		return nil, err
	}
	e.devname = devname

	return &DeviceWrapArgs{
		Me:         e.user,
		DeviceName: e.devname,
		DeviceType: e.arg.DeviceType,
		Lks:        e.lks,
	}, nil
}

// ensureLKSec ensures we have LKSec for saving device keys.
func (e *LoginProvision) ensureLKSec(ctx *Context) error {
	if e.lks != nil {
		return nil
	}

	pps, err := e.ppStream(ctx)
	if err != nil {
		return err
	}

	e.lks = libkb.NewLKSec(pps, e.user.GetUID(), e.G())
	return nil
}

// ppStream gets the passphrase stream, either cached or via
// SecretUI.
func (e *LoginProvision) ppStream(ctx *Context) (*libkb.PassphraseStream, error) {
	if ctx.LoginContext != nil {
		cached := ctx.LoginContext.PassphraseStreamCache()
		if cached == nil {
			return nil, errors.New("LoginProvision: ppStream() -> nil PassphraseStreamCache")
		}
		return cached.PassphraseStream(), nil
	}
	return e.G().LoginState().GetPassphraseStreamForUser(ctx.SecretUI, e.arg.Username)
}

// deviceName gets a new device name from the user.
func (e *LoginProvision) deviceName(ctx *Context) (string, error) {
	names, err := e.user.DeviceNames()
	if err != nil {
		e.G().Log.Debug("error getting device names: %s", err)
		e.G().Log.Debug("proceeding to ask user for a device name despite error...")
	}
	arg := keybase1.PromptNewDeviceNameArg{
		ExistingDevices: names,
	}
	return ctx.ProvisionUI.PromptNewDeviceName(context.TODO(), arg)
}

// makeDeviceKeys uses DeviceWrap to generate device keys.
func (e *LoginProvision) makeDeviceKeys(ctx *Context, args *DeviceWrapArgs) error {
	eng := NewDeviceWrap(args, e.G())
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}

	e.signingKey = eng.SigningKey()
	return nil
}

// loadUser will prompt for username (if not provided) and load the user.
func (e *LoginProvision) loadUser(ctx *Context) (*libkb.User, error) {
	if len(e.arg.Username) == 0 {
		username, err := ctx.LoginUI.GetEmailOrUsername(context.TODO(), 0)
		if err != nil {
			return nil, err
		}
		e.arg.Username = username
	}
	e.G().Log.Debug("LoginProvision: loading user %s", e.arg.Username)
	arg := libkb.NewLoadUserByNameArg(e.G(), e.arg.Username)
	arg.PublicKeyOptional = true
	return libkb.LoadUser(arg)
}

// syncedPGPKey looks for a synced pgp key for e.user.  If found,
// it unlocks it.
func (e *LoginProvision) syncedPGPKey(ctx *Context) (libkb.GenericKey, error) {
	key, err := e.user.SyncedSecretKey(ctx.LoginContext)
	if err != nil {
		return nil, err
	}
	if key == nil {
		return nil, libkb.NoKeyError{Msg: fmt.Sprintf("No synced secret PGP key stored on keybase.io for %s; please try logging in via GPG, an existing device, or a paper key", e.user.GetName())}
	}

	e.G().Log.Debug("got synced secret key")

	// unlock it
	unlocked, err := key.PromptAndUnlock(ctx.LoginContext, "sign new device", "keybase", nil, ctx.SecretUI, e.lks, e.user)
	if err != nil {
		return nil, err
	}

	e.G().Log.Debug("unlocked secret key")
	return unlocked, nil
}

// hasGPGPrivate returns true if GPG is available and contains
// private keys.
func (e *LoginProvision) hasGPGPrivate() bool {
	index, err := e.gpgPrivateIndex()
	if err != nil {
		e.G().Log.Debug("gpg not an option: get index error: %s", err)
		return false
	}

	e.G().Log.Debug("have gpg.  num private keys: %d", index.Len())

	return index.Len() > 0
}

// gpgPrivateIndex returns an index of the private gpg keys.
func (e *LoginProvision) gpgPrivateIndex() (*libkb.GpgKeyIndex, error) {
	cli, err := e.gpgClient()
	if err != nil {
		return nil, err
	}

	// get an index of all the secret keys
	index, _, err := cli.Index(true, "")
	if err != nil {
		return nil, err
	}

	return index, nil
}

// gpgClient returns a gpg client.
func (e *LoginProvision) gpgClient() (*libkb.GpgCLI, error) {
	if e.gpgCli != nil {
		return e.gpgCli, nil
	}

	gpg := e.G().GetGpgClient()
	if err := gpg.Configure(); err != nil {
		return nil, err
	}
	e.gpgCli = gpg
	return e.gpgCli, nil
}

// checkArg checks LoginProvisionArg for sane arguments.
func (e *LoginProvision) checkArg() error {
	// check we have a good device type:
	if e.arg.DeviceType != libkb.DeviceTypeDesktop && e.arg.DeviceType != libkb.DeviceTypeMobile {
		return libkb.InvalidArgumentError{Msg: fmt.Sprintf("device type must be %q or %q, not %q", libkb.DeviceTypeDesktop, libkb.DeviceTypeMobile, e.arg.DeviceType)}
	}

	return nil
}

// chooseMethod uses ProvisionUI to let user choose a provisioning
// method.
func (e *LoginProvision) chooseMethod(ctx *Context) (keybase1.ProvisionMethod, error) {
	hasGPGPrivate := e.hasGPGPrivate()
	e.G().Log.Debug("found gpg with private keys?: %v", hasGPGPrivate)

	arg := keybase1.ChooseProvisioningMethodArg{
		GpgOption: hasGPGPrivate,
	}
	return ctx.ProvisionUI.ChooseProvisioningMethod(context.TODO(), arg)
}

// runMethod runs the function for the chosen provisioning method.
func (e *LoginProvision) runMethod(ctx *Context, method keybase1.ProvisionMethod) error {
	// if there is an error running one of these, then the engine will
	// cleanup the state.
	e.cleanupOnErr = true
	switch method {
	case keybase1.ProvisionMethod_DEVICE:
		return e.device(ctx)
	case keybase1.ProvisionMethod_GPG:
		return e.gpg(ctx)
	case keybase1.ProvisionMethod_PAPER_KEY:
		return e.paper(ctx)
	case keybase1.ProvisionMethod_PASSPHRASE:
		return e.passphrase(ctx)
	}

	// no cleanup necessary as nothing ran
	e.cleanupOnErr = false
	return libkb.InternalError{Msg: fmt.Sprintf("unhandled provisioning method: %v", method)}
}

// ensurePaperKey checks to see if e.user has any paper keys.  If
// not, it makes one.
func (e *LoginProvision) ensurePaperKey(ctx *Context) error {
	// device provisioning doesn't load a user:
	if e.user == nil {
		return nil
	}

	// see if they have a paper key already
	cki := e.user.GetComputedKeyInfos()
	if cki != nil {
		if len(cki.PaperDevices()) > 0 {
			return nil
		}
	}

	// make one
	return e.paperKey(ctx)
}

// chooseGPGKey asks the user to select a gpg key to use, then
// checks if the fingerprint exists on keybase.io.
func (e *LoginProvision) chooseGPGKey(ctx *Context) (*libkb.GPGKey, error) {
	// choose a private gpg key to use
	fp, err := e.selectGPGKey(ctx)
	if err != nil {
		return nil, err
	}
	if fp == nil {
		return nil, libkb.NoKeyError{Msg: "selectGPGKey returned nil fingerprint"}
	}

	// see if public key on keybase, and if so load the user
	if err := e.checkUserByPGPFingerprint(ctx, fp); err != nil {
		return nil, err
	}

	// get KID for the pgp key
	kid, err := e.user.GetComputedKeyFamily().FindKIDFromFingerprint(*fp)
	if err != nil {
		return nil, err
	}

	// create a GPGKey shell around gpg cli with fp, kid
	return libkb.NewGPGKey(e.G(), fp, kid), nil
}

// selectGPGKey creates an index of the private gpg keys and
// presents them to the user who chooses one of them.
func (e *LoginProvision) selectGPGKey(ctx *Context) (fp *libkb.PGPFingerprint, err error) {
	index, err := e.gpgPrivateIndex()
	if err != nil {
		return nil, err
	}
	if index.Len() == 0 {
		return nil, libkb.NoSecretKeyError{}
	}

	fingerprints := make(map[string]*libkb.PGPFingerprint)
	var gks []keybase1.GPGKey
	for _, key := range index.Keys {
		gk := keybase1.GPGKey{
			Algorithm:  key.AlgoString(),
			KeyID:      key.ID64,
			Creation:   key.CreatedString(),
			Identities: key.GetPGPIdentities(),
		}
		gks = append(gks, gk)
		fingerprints[key.ID64] = key.GetFingerprint()
	}

	keyid, err := ctx.GPGUI.SelectKey(context.TODO(), keybase1.SelectKeyArg{Keys: gks})
	if err != nil {
		return nil, err
	}
	e.G().Log.Debug("SelectKey result: %s", keyid)
	fp, ok := fingerprints[keyid]
	if !ok {
		return nil, libkb.NoSecretKeyError{}
	}

	return fp, nil
}

// checkUserByPGPFingerprint looks up a fingerprint on keybase.io.  If it
// finds a username for keyid, it loads that user.
func (e *LoginProvision) checkUserByPGPFingerprint(ctx *Context, fp *libkb.PGPFingerprint) error {
	// see if public key on keybase
	username, uid, err := libkb.PGPLookupFingerprint(e.G(), fp)
	if err != nil {
		e.G().Log.Debug("error finding user for fp %s: %s", fp, err)
		return err
	}
	e.G().Log.Debug("found user (%s, %s) for key %s", username, uid, fp)

	// if so, will have username from that
	e.arg.Username = username
	e.user, err = e.loadUser(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (e *LoginProvision) getPaperKey(ctx *Context) (*keypair, error) {
	passphrase, err := ctx.SecretUI.GetPaperKeyPassphrase(keybase1.GetPaperKeyPassphraseArg{})
	if err != nil {
		return nil, err
	}
	paperPhrase := libkb.NewPaperKeyPhrase(passphrase)
	if paperPhrase.Version() != libkb.PaperKeyVersion {
		e.G().Log.Debug("paper version mismatch:  generated paper key version = %d, libkb version = %d", paperPhrase.Version(), libkb.PaperKeyVersion)
		return nil, libkb.KeyVersionError{}
	}

	bkarg := &PaperKeyGenArg{
		Passphrase: libkb.NewPaperKeyPhrase(passphrase),
		SkipPush:   true,
	}
	bkeng := NewPaperKeyGen(bkarg, e.G())
	if err := RunEngine(bkeng, ctx); err != nil {
		return nil, err
	}

	return &keypair{sigKey: bkeng.SigKey(), encKey: bkeng.EncKey()}, nil
}

func (e *LoginProvision) loadUserByKID(kid keybase1.KID) (*libkb.User, error) {
	arg := libkb.APIArg{
		Endpoint:     "key/owner",
		NeedSession:  false,
		Contextified: libkb.NewContextified(e.G()),
		Args:         libkb.HTTPArgs{"kid": libkb.S{Val: kid.String()}},
	}
	res, err := e.G().API.Get(arg)
	if err != nil {
		return nil, err
	}
	suid, err := res.Body.AtPath("uid").GetString()
	if err != nil {
		return nil, err
	}
	uid, err := keybase1.UIDFromString(suid)
	if err != nil {
		return nil, err
	}
	e.G().Log.Debug("key/owner result uid: %s", uid)
	loadArg := libkb.NewLoadUserArg(e.G())
	loadArg.UID = uid
	return libkb.LoadUser(loadArg)
}

func (e *LoginProvision) fetchLKS(ctx *Context, encKey libkb.GenericKey) error {
	gen, clientLKS, err := fetchLKS(ctx, e.G(), encKey)
	if err != nil {
		return err
	}
	e.lks = libkb.NewLKSecWithClientHalf(clientLKS, gen, e.user.GetUID(), e.G())
	return nil
}

func (e *LoginProvision) setSessionDeviceID(id keybase1.DeviceID) error {
	var serr error
	if err := e.G().LoginState().LocalSession(func(s *libkb.Session) {
		serr = s.SetDeviceProvisioned(id)
	}, "LoginProvision - device"); err != nil {
		return err
	}
	return serr
}

func (e *LoginProvision) displaySuccess(ctx *Context) error {
	if len(e.username) == 0 && e.user != nil {
		e.username = e.user.GetName()
	}
	sarg := keybase1.ProvisioneeSuccessArg{
		Username:   e.username,
		DeviceName: e.devname,
	}
	return ctx.ProvisionUI.ProvisioneeSuccess(context.TODO(), sarg)
}

func (e *LoginProvision) cleanup() {
	if !e.cleanupOnErr {
		return
	}

	// the best way to cleanup is to logout...
	e.G().Log.Debug("an error occurred during provisioning, logging out")
	e.G().Logout()
}

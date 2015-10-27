package engine

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// XLoginProvision is an engine that will provision the current
// device.
type XLoginProvision struct {
	libkb.Contextified
	arg        *XLoginProvisionArg
	user       *libkb.User
	lks        *libkb.LKSec
	signingKey libkb.GenericKey
	gpgCli     *libkb.GpgCLI
}

type XLoginProvisionArg struct {
	DeviceType string // desktop or mobile
	Username   string // optional
}

// NewXLoginProvision creates a XLoginProvision engine.  username
// is optional.
func NewXLoginProvision(g *libkb.GlobalContext, arg *XLoginProvisionArg) *XLoginProvision {
	return &XLoginProvision{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// Name is the unique engine name.
func (e *XLoginProvision) Name() string {
	return "XLoginProvision"
}

// GetPrereqs returns the engine prereqs.
func (e *XLoginProvision) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *XLoginProvision) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.ProvisionUIKind,
		libkb.LoginUIKind,
		libkb.SecretUIKind,
		libkb.GPGUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *XLoginProvision) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DeviceWrap{},
		&PaperKeyPrimary{},
	}
}

// Run starts the engine.
func (e *XLoginProvision) Run(ctx *Context) error {
	if err := e.checkArg(); err != nil {
		return err
	}

	method, err := e.chooseMethod(ctx)
	if err != nil {
		return err
	}

	if err := e.runMethod(ctx, method); err != nil {
		return err
	}

	return e.ensurePaperKey(ctx)
}

// device provisions this device with an existing device using the
// kex2 protocol.
func (e *XLoginProvision) device(ctx *Context) error {
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
		} else if receivedSecret != nil && len(receivedSecret) > 0 {
			e.G().Log.Warning("provisionee received secret: %x", receivedSecret)
			var ks kex2.Secret
			copy(ks[:], receivedSecret)
			provisionee.AddSecret(ks)
		}
	}()

	defer func() {
		if canceler != nil {
			e.G().Log.Debug("canceling DisplayAndPromptSecret call")
			canceler()
		}
	}()

	// run provisionee
	if err := RunEngine(provisionee, ctx); err != nil {
		return err
	}

	return nil
}

// gpg attempts to provision the device via a gpg key.
func (e *XLoginProvision) gpg(ctx *Context) error {
	bundle, err := e.chooseAndUnlockGPGKey(ctx)
	if err != nil {
		return err
	}

	e.G().Log.Debug("imported private gpg key %s", bundle.GetKID())

	// After obtaining login session, this will be called before the login state is released.
	// It signs this new device with the gpg key in bundle.
	var afterLogin = func(lctx libkb.LoginContext) error {
		ctx.LoginContext = lctx
		return e.makeDeviceKeysWithSigner(ctx, bundle)
	}

	// need a session to continue to provision
	return e.G().LoginState().LoginWithPrompt(e.user.GetName(), ctx.LoginUI, ctx.SecretUI, afterLogin)
}

// paper attempts to provision the device via a paper key.
func (e *XLoginProvision) paper(ctx *Context) error {
	// prompt for the username (if not provided) and load the user:
	var err error
	e.user, err = e.loadUser(ctx)
	if err != nil {
		return err
	}

	// find a paper key for this user
	kp, err := findPaperKeys(ctx, e.G(), e.user)
	if err != nil {
		return err
	}

	// found a paper key that can be used for signing
	e.G().Log.Debug("found paper key match for %s", e.user.GetName())

	// After obtaining login session, this will be called before the login state is released.
	// It signs this new device with the paper key.
	var afterLogin = func(lctx libkb.LoginContext) error {
		ctx.LoginContext = lctx
		return e.makeDeviceKeysWithSigner(ctx, kp.sigKey)
	}

	// need a session to continue to provision
	return e.G().LoginState().LoginWithPrompt(e.user.GetName(), ctx.LoginUI, ctx.SecretUI, afterLogin)
}

// passphrase attempts to provision the device via username and
// passphrase.  This will work if the user has no keys or only a
// synced pgp key.  Any other situations require different
// provisioning methods.
func (e *XLoginProvision) passphrase(ctx *Context) error {
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
func (e *XLoginProvision) pgpProvision(ctx *Context) error {
	// After obtaining login session, this will be called before the login state is released.
	// It tries to get the pgp key and uses it to provision new device keys for this device.
	var afterLogin = func(lctx libkb.LoginContext) error {
		ctx.LoginContext = lctx
		signer, err := e.syncedPGPKey(ctx)
		if err != nil {
			return err
		}

		return e.makeDeviceKeysWithSigner(ctx, signer)
	}

	// need a session to try to get synced private key
	return e.G().LoginState().LoginWithPrompt(e.user.GetName(), ctx.LoginUI, ctx.SecretUI, afterLogin)
}

// makeDeviceKeysWithSigner creates device keys given a signing
// key.
func (e *XLoginProvision) makeDeviceKeysWithSigner(ctx *Context, signer libkb.GenericKey) error {
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
func (e *XLoginProvision) addEldestDeviceKey(ctx *Context) error {
	args, err := e.makeDeviceWrapArgs(ctx)
	if err != nil {
		return err
	}
	args.IsEldest = true

	return e.makeDeviceKeys(ctx, args)
}

// paperKey generates a primary paper key for the user.
func (e *XLoginProvision) paperKey(ctx *Context) error {
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
func (e *XLoginProvision) makeDeviceWrapArgs(ctx *Context) (*DeviceWrapArgs, error) {
	if err := e.ensureLKSec(ctx); err != nil {
		return nil, err
	}

	devname, err := e.deviceName(ctx)
	if err != nil {
		return nil, err
	}

	return &DeviceWrapArgs{
		Me:         e.user,
		DeviceName: devname,
		DeviceType: e.arg.DeviceType,
		Lks:        e.lks,
	}, nil
}

// ensureLKSec ensures we have LKSec for saving device keys.
func (e *XLoginProvision) ensureLKSec(ctx *Context) error {
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
func (e *XLoginProvision) ppStream(ctx *Context) (*libkb.PassphraseStream, error) {
	if ctx.LoginContext != nil {
		cached := ctx.LoginContext.PassphraseStreamCache()
		if cached == nil {
			return nil, errors.New("nil PassphraseStreamCache")
		}
		return cached.PassphraseStream(), nil
	}
	return e.G().LoginState().GetPassphraseStream(ctx.SecretUI)
}

// deviceName gets a new device name from the user.
func (e *XLoginProvision) deviceName(ctx *Context) (string, error) {
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
func (e *XLoginProvision) makeDeviceKeys(ctx *Context, args *DeviceWrapArgs) error {
	eng := NewDeviceWrap(args, e.G())
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}

	e.signingKey = eng.SigningKey()
	return nil
}

// loadUser will prompt for username (if not provided) and load the user.
func (e *XLoginProvision) loadUser(ctx *Context) (*libkb.User, error) {
	if len(e.arg.Username) == 0 {
		username, err := ctx.LoginUI.GetEmailOrUsername(context.TODO(), 0)
		if err != nil {
			return nil, err
		}
		e.arg.Username = username
	}
	arg := libkb.NewLoadUserByNameArg(e.G(), e.arg.Username)
	arg.PublicKeyOptional = true
	return libkb.LoadUser(arg)
}

// syncedPGPKey looks for a synced pgp key for e.user.  If found,
// it unlocks it.
func (e *XLoginProvision) syncedPGPKey(ctx *Context) (libkb.GenericKey, error) {
	key, err := e.user.SyncedSecretKey(ctx.LoginContext)
	if err != nil {
		return nil, err
	}
	if key == nil {
		return nil, libkb.NoKeyError{Msg: "failed to get synced secret key"}
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
func (e *XLoginProvision) hasGPGPrivate() bool {
	index, err := e.gpgPrivateIndex()
	if err != nil {
		e.G().Log.Debug("gpg not an option: get index error: %s", err)
		return false
	}

	e.G().Log.Debug("have gpg.  num private keys: %d", index.Len())

	return index.Len() > 0
}

// gpgPrivateIndex returns an index of the private gpg keys.
func (e *XLoginProvision) gpgPrivateIndex() (*libkb.GpgKeyIndex, error) {
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
func (e *XLoginProvision) gpgClient() (*libkb.GpgCLI, error) {
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

// checkArg checks XLoginProvisionArg for sane arguments.
func (e *XLoginProvision) checkArg() error {
	// check we have a good device type:
	if e.arg.DeviceType != libkb.DeviceTypeDesktop && e.arg.DeviceType != libkb.DeviceTypeMobile {
		return libkb.InvalidArgumentError{Msg: fmt.Sprintf("device type must be %q or %q, not %q", libkb.DeviceTypeDesktop, libkb.DeviceTypeMobile, e.arg.DeviceType)}
	}

	return nil
}

// chooseMethod uses ProvisionUI to let user choose a provisioning
// method.
func (e *XLoginProvision) chooseMethod(ctx *Context) (keybase1.ProvisionMethod, error) {
	hasGPGPrivate := e.hasGPGPrivate()
	e.G().Log.Debug("found gpg with private keys?: %v", hasGPGPrivate)

	arg := keybase1.ChooseProvisioningMethodArg{
		GpgOption: hasGPGPrivate,
	}
	return ctx.ProvisionUI.ChooseProvisioningMethod(context.TODO(), arg)
}

// runMethod runs the function for the chosen provisioning method.
func (e *XLoginProvision) runMethod(ctx *Context, method keybase1.ProvisionMethod) error {
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

	return libkb.InternalError{Msg: fmt.Sprintf("unhandled provisioning method: %v", method)}
}

// ensurePaperKey checks to see if e.user has any paper keys.  If
// not, it makes one.
func (e *XLoginProvision) ensurePaperKey(ctx *Context) error {
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

// chooseAndUnlockGPGKey asks the user to select a gpg key to use,
// then checks if the fingerprint exists on keybase.io, and
// finally uses gpg to unlock it.
func (e *XLoginProvision) chooseAndUnlockGPGKey(ctx *Context) (*libkb.PGPKeyBundle, error) {
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

	// unlock it with gpg
	cli, err := e.gpgClient()
	if err != nil {
		return nil, err
	}
	return cli.ImportKey(true, *fp)
}

// selectGPGKey creates an index of the private gpg keys and
// presents them to the user who chooses one of them.
func (e *XLoginProvision) selectGPGKey(ctx *Context) (fp *libkb.PGPFingerprint, err error) {
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
func (e *XLoginProvision) checkUserByPGPFingerprint(ctx *Context, fp *libkb.PGPFingerprint) error {
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

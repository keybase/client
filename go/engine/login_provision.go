// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"
	"sort"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// loginProvision is an engine that will provision the current
// device.  Only the Login engine should run it.
type loginProvision struct {
	libkb.Contextified
	arg            *loginProvisionArg
	lks            *libkb.LKSec
	signingKey     libkb.GenericKey
	encryptionKey  libkb.NaclDHKeyPair
	gpgCli         gpgInterface
	username       string
	devname        string
	hasPGP         bool
	hasDevice      bool
	perUserKeyring *libkb.PerUserKeyring

	skippedLogin  bool
	resetComplete bool
}

// gpgInterface defines the portions of gpg client that provision
// needs.  This allows tests to stub out gpg client calls.
type gpgInterface interface {
	ImportKey(secret bool, fp libkb.PGPFingerprint, tty string) (*libkb.PGPKeyBundle, error)
	Index(secret bool, query string) (ki *libkb.GpgKeyIndex, w libkb.Warnings, err error)
}

type loginProvisionArg struct {
	DeviceType string // desktop or mobile
	ClientType keybase1.ClientType
	User       *libkb.User

	// Used for non-interactive provisioning
	PaperKey   string
	DeviceName string

	// Used in tests for reproducible key generation
	naclSigningKeyPair    libkb.NaclKeyPair
	naclEncryptionKeyPair libkb.NaclKeyPair
}

// newLoginProvision creates a loginProvision engine.
func newLoginProvision(g *libkb.GlobalContext, arg *loginProvisionArg) *loginProvision {
	return &loginProvision{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// Name is the unique engine name.
func (e *loginProvision) Name() string {
	return "loginProvision"
}

// GetPrereqs returns the engine prereqs.
func (e *loginProvision) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *loginProvision) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.ProvisionUIKind,
		libkb.LoginUIKind,
		libkb.SecretUIKind,
		libkb.GPGUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *loginProvision) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DeviceWrap{},
		&PaperKeyPrimary{},
		&AccountReset{},
	}
}

// Run starts the engine.
func (e *loginProvision) Run(m libkb.MetaContext) error {
	m.G().LocalSigchainGuard().Set(m.Ctx(), "loginProvision")
	defer m.G().LocalSigchainGuard().Clear(m.Ctx(), "loginProvision")

	if err := e.checkArg(); err != nil {
		return err
	}

	if err := m.G().SecretStore().PrimeSecretStores(m); err != nil {
		return SecretStoreNotFunctionalError{err}
	}

	var err error
	e.perUserKeyring, err = libkb.NewPerUserKeyring(m.G(), e.arg.User.GetUID())
	if err != nil {
		return err
	}

	// based on information in e.arg.User, route the user
	// through the provisioning options.
	if err := e.route(m); err != nil {
		switch err.(type) {
		case libkb.APINetError:
			m.Debug("provision failed with an APINetError: %s, returning ProvisionFailedOfflineError", err)
			return libkb.ProvisionFailedOfflineError{}
		}

		return err
	}
	if e.skippedLogin || e.resetComplete {
		return nil
	}

	// e.route is point of no return. If it succeeds, it means that
	// config has already been written and there is no way to roll
	// back.

	e.displaySuccess(m)

	m.G().KeyfamilyChanged(m.Ctx(), e.arg.User.GetUID())

	// check to make sure local files stored correctly
	verifyLocalStorage(m, e.username, e.arg.User.GetUID())

	// initialize a stellar wallet for the user if they don't already have one.
	m.G().LocalSigchainGuard().Clear(m.Ctx(), "loginProvision")
	m.G().GetStellar().CreateWalletSoft(context.Background())

	return nil
}

func (e *loginProvision) saveToSecretStore(m libkb.MetaContext) error {
	return e.saveToSecretStoreWithLKS(m, e.lks)
}

func (e *loginProvision) saveToSecretStoreWithLKS(m libkb.MetaContext, lks *libkb.LKSec) (err error) {
	nun := e.arg.User.GetNormalizedName()
	defer m.Trace(fmt.Sprintf("loginProvision.saveToSecretStoreWithLKS(%s)", nun), func() error { return err })()
	options := libkb.LoadAdvisorySecretStoreOptionsFromRemote(m)
	return libkb.StoreSecretAfterLoginWithLKSWithOptions(m, nun, lks, &options)
}

// deviceWithType provisions this device with an existing device using the
// kex2 protocol.  provisionerType is the existing device type.
func (e *loginProvision) deviceWithType(m libkb.MetaContext, provisionerType keybase1.DeviceType) (err error) {
	defer m.Trace("loginProvision#deviceWithType", func() error { return err })()

	// make a new device:
	deviceID, err := libkb.NewDeviceID()
	if err != nil {
		return err
	}
	device := &libkb.Device{
		ID:   deviceID,
		Type: e.arg.DeviceType,
	}

	// prompt for the device name here so there's no delay during kex:
	m.Debug("deviceWithType: prompting for device name")
	name, err := e.deviceName(m)
	if err != nil {
		m.Debug("deviceWithType: error getting device name from user: %s", err)
		return err
	}
	device.Description = &name
	m.Debug("deviceWithType: got device name: %q", name)

	// make a new secret:
	uid := m.CurrentUID()

	// Continue to generate legacy Kex2 secret types
	kex2SecretTyp := libkb.Kex2SecretTypeV1Desktop
	if e.arg.DeviceType == libkb.DeviceTypeMobile || provisionerType == keybase1.DeviceType_MOBILE {
		kex2SecretTyp = libkb.Kex2SecretTypeV1Mobile
	}
	m.Debug("Generating Kex2 secret for uid=%s, typ=%d", uid, kex2SecretTyp)
	secret, err := libkb.NewKex2SecretFromTypeAndUID(kex2SecretTyp, uid)
	if err != nil {
		return err
	}

	// create provisionee engine
	salt, err := e.arg.User.GetSalt()
	if err != nil {
		m.Debug("Failed to get salt")
		return err
	}
	provisionee := NewKex2Provisionee(m.G(), device, secret.Secret(), e.arg.User.GetUID(), salt)

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
		for i := 0; i < 10; i++ {
			receivedSecret, err := m.UIs().ProvisionUI.DisplayAndPromptSecret(contxt, arg)
			if err != nil {
				// cancel provisionee run:
				provisionee.Cancel()
				m.Warning("DisplayAndPromptSecret error: %s", err)
				break
			} else if receivedSecret.Secret != nil && len(receivedSecret.Secret) > 0 {
				m.Debug("received secret, adding to provisionee")
				var ks kex2.Secret
				copy(ks[:], receivedSecret.Secret)
				provisionee.AddSecret(ks)
				break
			} else if len(receivedSecret.Phrase) > 0 {
				m.Debug("received secret phrase, checking validity")
				checker := libkb.MakeCheckKex2SecretPhrase(m.G())
				if !checker.F(receivedSecret.Phrase) {
					m.Debug("secret phrase failed validity check (attempt %d)", i)
					arg.PreviousErr = checker.Hint
					continue
				}
				m.Debug("received secret phrase, adding to provisionee")
				ks, err := libkb.NewKex2SecretFromUIDAndPhrase(uid, receivedSecret.Phrase)
				if err != nil {
					m.Warning("DisplayAndPromptSecret error: %s", err)
				} else {
					provisionee.AddSecret(ks.Secret())
				}
				break
			} else {
				// empty secret, so must have been a display-only case.
				// ok to stop the loop
				m.Debug("login provision DisplayAndPromptSecret returned empty secret, stopping retry loop")
				break
			}
		}
	}()

	defer func() {
		if canceler != nil {
			m.Debug("canceling DisplayAndPromptSecret call")
			canceler()
		}
	}()

	err = RunEngine2(m, provisionee)
	if err != nil {
		return err
	}

	e.saveToSecretStoreWithLKS(m, provisionee.GetLKSec())

	e.signingKey, err = provisionee.SigningKey()
	if err != nil {
		return err
	}
	e.encryptionKey, err = provisionee.EncryptionKey()
	if err != nil {
		return err
	}

	// Load me again so that keys will be up to date.
	loadArg := libkb.NewLoadUserArgWithMetaContext(m).WithSelf(true).WithUID(e.arg.User.GetUID())
	e.arg.User, err = libkb.LoadUser(loadArg)
	if err != nil {
		return err
	}

	// need username, device name for ProvisionUI.ProvisioneeSuccess()
	e.username = provisionee.GetName()
	pdevice := provisionee.Device()
	if pdevice == nil {
		m.Warning("nil provisionee device")
	} else if pdevice.Description == nil {
		m.Warning("nil provisionee device description")
	} else {
		e.devname = *pdevice.Description
	}

	return nil
}

// paper attempts to provision the device via a paper key.
func (e *loginProvision) paper(m libkb.MetaContext, device *libkb.Device, keys *libkb.DeviceWithKeys) (err error) {
	defer m.Trace("loginProvision#paper", func() error { return err })()

	// get the paper key from the user if we're in the interactive flow
	if keys == nil {
		expectedPrefix := device.Description
		keys, err = e.getValidPaperKey(m, expectedPrefix)
		if err != nil {
			return err
		}
	}

	u := e.arg.User
	uv := u.ToUserVersion()
	nn := u.GetNormalizedName()

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

	// The DeviceWrap engine (called via makeDeviceKeysWithSigner) sets
	// the global ActiveDevice to be a valid device. So we're OK to remove
	// our temporary thread-local paperkey device installed just above.
	m = m.WithGlobalActiveDevice()

	// Cache the paper keys globally now that we're logged in. Note we must call
	// this after the m.WithGlobalActiveDevice() above, since we want to cache
	// the paper key on the global and not thread-local active device.
	m.ActiveDevice().CacheProvisioningKey(m, keys)

	e.saveToSecretStore(m)
	return nil
}

var paperKeyNotFound = libkb.NotFoundError{
	Msg: "paper key not found, most likely due to a typo in one of the words in the phrase",
}

func (e *loginProvision) getValidPaperKey(m libkb.MetaContext, expectedPrefix *string) (keys *libkb.DeviceWithKeys, err error) {
	defer m.Trace("loginProvision#getValidPaperKey", func() error { return err })()

	for i := 0; i < 10; i++ {
		keys, err = e.getValidPaperKeyOnce(m, i, err, expectedPrefix)
		if err == nil {
			return keys, err
		}
		if _, ok := err.(libkb.InputCanceledError); ok {
			return nil, err
		}
	}
	m.Debug("getValidPaperKey retry attempts exhausted")
	return nil, err
}

func (e *loginProvision) getValidPaperKeyOnce(m libkb.MetaContext, i int, lastErr error, expectedPrefix *string) (keys *libkb.DeviceWithKeys, err error) {
	defer m.Trace("loginProvision#getValidPaperKeyOnce", func() error { return err })()

	// get the paper key from the user
	var prefix string
	keys, prefix, err = getPaperKey(m, lastErr, expectedPrefix)
	if err != nil {
		m.Debug("getValidPaperKeyOnce attempt %d (%s): %s", i, prefix, err)
		return nil, err
	}

	// use the KID to find the uid, deviceID and deviceName
	var uid keybase1.UID
	uid, err = keys.Populate(m)
	if err != nil {
		m.Debug("getValidPaperKeyOnce attempt %d (%s): %s", i, prefix, err)

		switch err := err.(type) {
		case libkb.NotFoundError:
			return nil, paperKeyNotFound
		case libkb.AppStatusError:
			if err.Code == libkb.SCNotFound {
				return nil, paperKeyNotFound
			}
		}
		return nil, err
	}

	if uid.NotEqual(e.arg.User.GetUID()) {
		return nil, paperKeyNotFound
	}

	// found a paper key that can be used for signing
	m.Debug("found paper key (%s) match for %s", prefix, e.arg.User.GetName())
	return keys, nil
}

// pgpProvision attempts to provision with a synced pgp key.  It
// needs to get a session first to look for a synced pgp key.
func (e *loginProvision) pgpProvision(m libkb.MetaContext) (err error) {
	defer m.Trace("loginProvision#pgpProvision", func() error { return err })()

	err = e.passphraseLogin(m)
	if err != nil {
		return err
	}

	// After obtaining login session, this will be called before the login state is released.
	// It tries to get the pgp key and uses it to provision new device keys for this device.
	signer, err := e.syncedPGPKey(m)
	if err != nil {
		return err
	}

	if err = e.makeDeviceKeysWithSigner(m, signer); err != nil {
		return err
	}

	e.saveToSecretStore(m)
	return nil
}

// makeDeviceKeysWithSigner creates device keys given a signing
// key.
func (e *loginProvision) makeDeviceKeysWithSigner(m libkb.MetaContext, signer libkb.GenericKey) error {
	args, err := e.makeDeviceWrapArgs(m)
	if err != nil {
		return err
	}
	args.Signer = signer
	args.IsEldest = false // just to be explicit
	args.EldestKID = e.arg.User.GetEldestKID()

	return e.makeDeviceKeys(m, args)
}

// makeDeviceWrapArgs creates a base set of args for DeviceWrap.
// It ensures that LKSec is created.  It also gets a new device
// name for this device.
func (e *loginProvision) makeDeviceWrapArgs(m libkb.MetaContext) (*DeviceWrapArgs, error) {
	if err := e.ensureLKSec(m); err != nil {
		return nil, err
	}

	devname, err := e.deviceName(m)
	if err != nil {
		return nil, err
	}
	e.devname = devname

	return &DeviceWrapArgs{
		Me:                    e.arg.User,
		DeviceName:            e.devname,
		DeviceType:            e.arg.DeviceType,
		Lks:                   e.lks,
		PerUserKeyring:        e.perUserKeyring,
		naclSigningKeyPair:    e.arg.naclSigningKeyPair,
		naclEncryptionKeyPair: e.arg.naclEncryptionKeyPair,
	}, nil
}

// ensureLKSec ensures we have LKSec for saving device keys.
func (e *loginProvision) ensureLKSec(m libkb.MetaContext) error {
	if e.lks != nil {
		return nil
	}

	pps, err := e.recoverAfterFailedSignup(m)
	if err != nil {
		m.Debug("recoverAfterFailedSignup not possible: %s, continuing with e.ppStream", err)
		pps, err = e.ppStream(m)
		if err != nil {
			return err
		}
	}

	e.lks = libkb.NewLKSec(pps, e.arg.User.GetUID())
	return nil
}

func (e *loginProvision) recoverAfterFailedSignup(mctx libkb.MetaContext) (ret *libkb.PassphraseStream, err error) {
	mctx = mctx.WithLogTag("RSGNUP")
	user := e.arg.User
	defer mctx.TraceTimed(fmt.Sprintf("recoverAfterFailedSignup(%q)", user.GetNormalizedName()),
		func() error { return err })()

	if !user.GetCurrentEldestSeqno().Eq(keybase1.Seqno(0)) {
		return nil, errors.New("user has live sigchain, cannot do recover-after-signup login")
	}

	username := user.GetNormalizedName()
	uid := user.GetUID()

	stream, err := libkb.RetrievePwhashEddsaPassphraseStream(mctx, username, uid)
	if err != nil {
		return nil, err
	}

	err = libkb.LoginFromPassphraseStream(mctx, username.String(), stream)
	if err != nil {
		return nil, err
	}

	ok, err := mctx.LoginContext().LoggedInLoad()
	mctx.Debug("LoggedInLoad: ok=%t err=%v", ok, err)
	return stream, nil
}

// ppStream gets the passphrase stream, either cached or via
// SecretUI.
func (e *loginProvision) ppStream(m libkb.MetaContext) (ret *libkb.PassphraseStream, err error) {
	defer m.Trace("loginProvision#ppStream", func() error { return err })()
	if ret = m.PassphraseStream(); ret != nil {
		return ret, nil
	}
	if err = e.passphraseLogin(m); err != nil {
		return nil, err
	}
	if ret = m.PassphraseStream(); ret != nil {
		return ret, nil
	}
	return nil, errors.New("no passphrase available")
}

func (e *loginProvision) passphraseLogin(m libkb.MetaContext) (err error) {
	defer m.Trace("loginProvision#passphraseLogin", func() error { return err })()

	if m.LoginContext() != nil {
		ok, _ := m.LoginContext().LoggedInLoad()
		if ok {
			m.Debug("already logged in")
			return nil
		}
	}

	return libkb.PassphraseLoginPromptThenSecretStore(m, e.arg.User.GetName(), 5, false)
}

// deviceName gets a new device name from the user.
func (e *loginProvision) deviceName(m libkb.MetaContext) (string, error) {
	var names []string
	upk, _, err := m.G().GetUPAKLoader().LoadV2(libkb.NewLoadUserArgWithMetaContext(m).WithUID(e.arg.User.GetUID()).WithPublicKeyOptional().WithForcePoll(true).WithSelf(true))
	if err != nil {
		m.Debug("error getting device names via upak: %s", err)
		m.Debug("proceeding to ask user for a device name despite error...")
	} else {
		names = upk.AllDeviceNames()
	}

	// Fully non-interactive flow
	if e.arg.DeviceName != "" {
		return e.automatedDeviceName(m, names, e.arg.DeviceName)
	}

	arg := keybase1.PromptNewDeviceNameArg{
		ExistingDevices: names,
	}

	for i := 0; i < 10; i++ {
		devname, err := m.UIs().ProvisionUI.PromptNewDeviceName(m.Ctx(), arg)
		if err != nil {
			return "", err
		}
		if !libkb.CheckDeviceName.F(devname) {
			m.Debug("invalid device name supplied: %s", devname)
			arg.ErrorMessage = "Invalid device name. Device names should be " + libkb.CheckDeviceName.Hint
			continue
		}
		devname = libkb.CheckDeviceName.Transform(devname)
		var dupname string
		normalizedDevName := libkb.CheckDeviceName.Normalize(devname)
		for _, name := range names {
			if normalizedDevName == libkb.CheckDeviceName.Normalize(name) {
				dupname = name
				break
			}
		}

		if dupname != "" {
			m.Debug("Device name reused: %q == %q", devname, dupname)
			var dupnameErrMsg string
			// if we have a collision on the normalized values add some extra
			// info the error message so the user isn't confused why we
			// consider the names equal.
			if devname != dupname {
				dupnameErrMsg = fmt.Sprintf(" as %q", dupname)
			}
			arg.ErrorMessage = fmt.Sprintf("You've already used this device name%s. For security reasons, pick another name.", dupnameErrMsg)
			continue
		}

		return devname, nil
	}
	return "", libkb.RetryExhaustedError{}
}

func (e *loginProvision) automatedDeviceName(m libkb.MetaContext, existing []string, devname string) (string, error) {
	if !libkb.CheckDeviceName.F(devname) {
		return "", libkb.DeviceBadNameError{}
	}

	devname = libkb.CheckDeviceName.Transform(devname)
	normalizedDevName := libkb.CheckDeviceName.Normalize(devname)
	for _, name := range existing {
		if normalizedDevName == libkb.CheckDeviceName.Normalize(name) {
			m.Debug("Device name reused: %q == %q", devname, name)
			return "", libkb.DeviceNameInUseError{}
		}
	}

	return devname, nil
}

// makeDeviceKeys uses DeviceWrap to generate device keys.
func (e *loginProvision) makeDeviceKeys(m libkb.MetaContext, args *DeviceWrapArgs) error {
	eng := NewDeviceWrap(m.G(), args)
	if err := RunEngine2(m, eng); err != nil {
		return err
	}
	// Finish provisoning by calling SwitchConfigAndActiveDevice. we
	// can't undo that, so do not error out after that.
	if err := eng.SwitchConfigAndActiveDevice(m); err != nil {
		return err
	}

	e.signingKey = eng.SigningKey()
	e.encryptionKey = eng.EncryptionKey()

	return nil
}

// syncedPGPKey looks for a synced pgp key for e.user.  If found,
// it unlocks it.
func (e *loginProvision) syncedPGPKey(m libkb.MetaContext) (ret libkb.GenericKey, err error) {
	defer m.Trace("loginProvision#syncedPGPKey", func() error { return err })()

	key, err := e.arg.User.SyncedSecretKey(m)
	if err != nil {
		return nil, err
	}
	if key == nil {
		return nil, libkb.NoSyncedPGPKeyError{}
	}

	m.Debug("got synced secret key")

	// unlock it
	// XXX improve this prompt
	parg := m.SecretKeyPromptArg(libkb.SecretKeyArg{}, "sign new device")
	unlocked, err := key.PromptAndUnlock(m, parg, nil, e.arg.User)
	if err != nil {
		return nil, err
	}

	m.Debug("unlocked secret key")
	return unlocked, nil
}

// gpgPrivateIndex returns an index of the private gpg keys.
func (e *loginProvision) gpgPrivateIndex(m libkb.MetaContext) (*libkb.GpgKeyIndex, error) {
	cli, err := e.gpgClient(m)
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
func (e *loginProvision) gpgClient(m libkb.MetaContext) (gpgInterface, error) {
	if e.arg.DeviceType == libkb.DeviceTypeMobile {
		return nil, libkb.GPGUnavailableError{}
	}
	if e.gpgCli != nil {
		return e.gpgCli, nil
	}

	gpg := m.G().GetGpgClient()
	ok, err := gpg.CanExec()
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, libkb.GPGUnavailableError{}
	}
	e.gpgCli = gpg
	return e.gpgCli, nil
}

// checkArg checks loginProvisionArg for sane arguments.
func (e *loginProvision) checkArg() error {
	// check we have a good device type:
	if e.arg.DeviceType != libkb.DeviceTypeDesktop && e.arg.DeviceType != libkb.DeviceTypeMobile {
		return libkb.InvalidArgumentError{Msg: fmt.Sprintf("device type must be %q or %q, not %q", libkb.DeviceTypeDesktop, libkb.DeviceTypeMobile, e.arg.DeviceType)}
	}

	if e.arg.User == nil {
		return libkb.InvalidArgumentError{Msg: "User cannot be nil"}
	}

	return nil
}

func (e *loginProvision) route(m libkb.MetaContext) (err error) {

	defer m.Trace("loginProvision#route", func() error { return err })()

	// check if User has any pgp keys, active devices
	ckf := e.arg.User.GetComputedKeyFamily()
	if ckf != nil {
		e.hasPGP = len(ckf.GetActivePGPKeys(false)) > 0
		e.hasDevice = ckf.HasActiveDevice()
	}

	if e.hasDevice {
		return e.chooseDevice(m, e.hasPGP)
	}

	if e.hasPGP {
		return e.tryPGP(m)
	}

	if !e.arg.User.GetEldestKID().IsNil() {
		// The user has no PGP keys and no devices, but they do have an eldest
		// KID. That means they've revoked all their devices. They have to
		// reset their account at this point.
		// TODO: Once we make your account auto-reset after revoking your last
		// device, change this error message.
		return errors.New("Cannot add a new device when all existing devices are revoked. Reset your account on keybase.io.")
	}

	// User has no existing devices or pgp keys, so create
	// the eldest device.
	return e.makeEldestDevice(m)
}

func (e *loginProvision) chooseDevice(m libkb.MetaContext, pgp bool) (err error) {
	defer m.Trace("loginProvision#chooseDevice", func() error { return err })()

	ckf := e.arg.User.GetComputedKeyFamily()
	devices := partitionDeviceList(ckf.GetAllActiveDevices())
	sort.Sort(devices)

	// Fully non-interactive flow
	if e.arg.PaperKey != "" {
		return e.preloadedPaperKey(m, devices, e.arg.PaperKey)
	}

	expDevices := make([]keybase1.Device, len(devices))
	idMap := make(map[keybase1.DeviceID]*libkb.Device)
	for i, d := range devices {
		expDevices[i] = *d.ProtExport()
		idMap[d.ID] = d
	}

	autoresetEnabled := m.G().Env.GetFeatureFlags().HasFeature(libkb.EnvironmentFeatureAutoresetPipeline)

	// check to see if they have a PUK, in which case they must select a device
	hasPUK, err := e.hasPerUserKey(m)
	if err != nil {
		return err
	}

	arg := keybase1.ChooseDeviceArg{
		Devices:           expDevices,
		CanSelectNoDevice: (pgp && !hasPUK) || autoresetEnabled,
	}
	id, err := m.UIs().ProvisionUI.ChooseDevice(m.Ctx(), arg)
	if err != nil {
		return err
	}

	if len(id) == 0 {
		// they chose not to use a device
		m.Debug("user has devices, but chose not to use any of them")

		if pgp && !hasPUK {
			// they have pgp keys, so try that:
			err = e.tryPGP(m)
			if err == nil {
				// Provisioning succeeded
				return nil
			}

			// If autoreset is enabled, an error here should passthrough into
			// autoreset.
			if autoresetEnabled {
				m.Warning("Unable to log in with a PGP signature: %s", err.Error())
			} else {
				return err
			}
		}

		// Error differs depending on the input.
		if !autoresetEnabled {
			if pgp && hasPUK {
				return libkb.ProvisionViaDeviceRequiredError{}
			}
			return libkb.ProvisionUnavailableError{}
		}

		// Prompt the user whether they'd like to enter the reset flow.
		// We will ask them for a password in AccountReset.
		enterReset, err := m.UIs().LoginUI.PromptResetAccount(m.Ctx(), keybase1.PromptResetAccountArg{
			Kind: keybase1.ResetPromptType_ENTER_NO_DEVICES,
		})
		if err != nil {
			return err
		}

		if !enterReset {
			m.Debug("User decided not to enter the reset pipeline")
			// User had to explicitly decline entering the pipeline so in order to prevent
			// confusion prevent further prompts by completing a noop login flow.
			e.skippedLogin = true
			return nil
		}

		// go into the reset flow
		eng := NewAccountReset(m.G(), e.arg.User.GetName())
		eng.completeReset = true
		if err := eng.Run(m); err != nil {
			return err
		}

		e.skippedLogin = eng.ResetPending()
		e.resetComplete = eng.ResetComplete()
		return nil
	}

	m.Debug("user selected device %s", id)
	selected, ok := idMap[id]
	if !ok {
		return fmt.Errorf("selected device %s not in local device map", id)
	}
	m.Debug("device details: %+v", selected)

	switch selected.Type {
	case libkb.DeviceTypePaper:
		return e.paper(m, selected, nil)
	case libkb.DeviceTypeDesktop:
		return e.deviceWithType(m, keybase1.DeviceType_DESKTOP)
	case libkb.DeviceTypeMobile:
		return e.deviceWithType(m, keybase1.DeviceType_MOBILE)
	default:
		return fmt.Errorf("unknown device type: %v", selected.Type)
	}
}

func (e *loginProvision) preloadedPaperKey(m libkb.MetaContext, devices []*libkb.Device, paperKey string) error {
	// User has requested non-interactive provisioning - first parse their key
	keys, prefix, err := getPaperKeyFromString(m, e.arg.PaperKey)
	if err != nil {
		return err
	}

	// ... then match it to the paper keys that can be used with this account
	var matchedDevice *libkb.Device
	for _, d := range devices {
		if d.Type != libkb.DeviceTypePaper {
			continue
		}
		if prefix != *d.Description {
			continue
		}

		matchedDevice = d
		break
	}

	if matchedDevice == nil {
		return libkb.NoPaperKeysError{}
	}

	// use the KID to find the uid, deviceID and deviceName
	uid, err := keys.Populate(m)
	if err != nil {
		switch err := err.(type) {
		case libkb.NotFoundError:
			return paperKeyNotFound
		case libkb.AppStatusError:
			if err.Code == libkb.SCNotFound {
				return paperKeyNotFound
			}
		}
		return err
	}
	if uid.NotEqual(e.arg.User.GetUID()) {
		return paperKeyNotFound
	}

	return e.paper(m, matchedDevice, keys)
}

func (e *loginProvision) tryPGP(m libkb.MetaContext) (err error) {
	defer m.Trace("loginProvision#tryPGP", func() error { return err })()

	err = e.pgpProvision(m)
	if err == nil {
		return nil
	}

	if _, ok := err.(libkb.NoSyncedPGPKeyError); !ok {
		// error during pgpProvision was not about no synced pgp key,
		// so return it
		return err
	}

	m.Debug("no synced pgp key found, trying GPG")
	return e.tryGPG(m)
}

func (e *loginProvision) tryGPG(m libkb.MetaContext) (err error) {
	defer m.Trace("loginProvision#tryGPG", func() error { return err })()
	key, method, err := e.chooseGPGKeyAndMethod(m)
	if err != nil {
		return err
	}

	// depending on the method, get a signing key
	var signingKey libkb.GenericKey
	switch method {
	case keybase1.GPGMethod_GPG_IMPORT:
		signingKey, err = e.gpgImportKey(m, key.GetFingerprint())
		if err != nil {
			// There was an error importing the key.
			// So offer to switch to using gpg to sign
			// the provisioning statement:
			signingKey, err = e.switchToGPGSign(m, key, err)
			if err != nil {
				return err
			}
			method = keybase1.GPGMethod_GPG_SIGN
		}
	case keybase1.GPGMethod_GPG_SIGN:
		signingKey, err = e.gpgSignKey(m, key.GetFingerprint())
		if err != nil {
			return err
		}
	default:
		return fmt.Errorf("invalid gpg provisioning method: %v", method)
	}

	if err = e.passphraseLogin(m); err != nil {
		return err
	}

	if err := e.makeDeviceKeysWithSigner(m, signingKey); err != nil {
		if appErr, ok := err.(libkb.AppStatusError); ok && appErr.Code == libkb.SCKeyCorrupted {
			// Propagate the error, but display a more descriptive message to the user.
			m.G().Log.Error("during GPG provisioning.\nWe were able to generate a PGP signature " +
				"with gpg client, but it was rejected by the server. This often means that this " +
				"PGP key is expired or unusable. You can update your key on https://keybase.io")
		}
		return err
	}
	e.saveToSecretStore(m)

	if method == keybase1.GPGMethod_GPG_IMPORT {
		// store the key in lksec
		_, err := libkb.WriteLksSKBToKeyring(m, signingKey, e.lks)
		if err != nil {
			m.Warning("error saving exported gpg key in lksec: %s", err)
			return err
		}
	}

	return nil
}

func (e *loginProvision) chooseGPGKeyAndMethod(m libkb.MetaContext) (*libkb.GpgPrimaryKey, keybase1.GPGMethod, error) {
	nilMethod := keybase1.GPGMethod_GPG_NONE
	// find any local private gpg keys that are in user's key family
	matches, err := e.matchingGPGKeys(m)
	if err != nil {
		if _, ok := err.(libkb.NoSecretKeyError); ok {
			// no match found
			// tell the user they need to get a gpg
			// key onto this device.
		}
		return nil, nilMethod, err
	}

	// have a match
	for _, match := range matches {
		m.Debug("matching gpg key: %+v", match)
	}

	// create protocol array of keys
	var gks []keybase1.GPGKey
	gkmap := make(map[string]*libkb.GpgPrimaryKey)
	for _, key := range matches {
		gk := keybase1.GPGKey{
			Algorithm:  key.AlgoString(),
			KeyID:      key.ID64,
			Creation:   key.CreatedString(),
			Identities: key.GetPGPIdentities(),
		}
		gks = append(gks, gk)
		gkmap[key.ID64] = key
	}

	// ask if they want to import or sign
	arg := keybase1.ChooseGPGMethodArg{
		Keys: gks,
	}
	method, err := m.UIs().ProvisionUI.ChooseGPGMethod(m.Ctx(), arg)
	if err != nil {
		return nil, nilMethod, err
	}

	// select the key to use
	var key *libkb.GpgPrimaryKey
	if len(matches) == 1 {
		key = matches[0]
	} else {
		// if more than one match, show the user the matching keys, ask for selection
		keyid, err := m.UIs().GPGUI.SelectKey(m.Ctx(), keybase1.SelectKeyArg{Keys: gks})
		if err != nil {
			return nil, nilMethod, err
		}

		var ok bool
		key, ok = gkmap[keyid]
		if !ok {
			return nil, nilMethod, fmt.Errorf("key id %v from select key not in local gpg key map", keyid)
		}
	}

	m.Debug("using gpg key %v for provisioning", key)

	return key, method, nil
}

func (e *loginProvision) switchToGPGSign(m libkb.MetaContext, key *libkb.GpgPrimaryKey, importError error) (libkb.GenericKey, error) {
	gk := keybase1.GPGKey{
		Algorithm:  key.AlgoString(),
		KeyID:      key.ID64,
		Creation:   key.CreatedString(),
		Identities: key.GetPGPIdentities(),
	}
	arg := keybase1.SwitchToGPGSignOKArg{
		Key:         gk,
		ImportError: importError.Error(),
	}
	ok, err := m.UIs().ProvisionUI.SwitchToGPGSignOK(m.Ctx(), arg)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("user chose not to switch to GPG sign, original import error: %s", importError)
	}

	m.Debug("switching to GPG sign")
	return e.gpgSignKey(m, key.GetFingerprint())
}

func (e *loginProvision) matchingGPGKeys(m libkb.MetaContext) ([]*libkb.GpgPrimaryKey, error) {
	index, err := e.gpgPrivateIndex(m)
	if err != nil {
		return nil, err
	}

	kfKeys := e.arg.User.GetComputedKeyFamily().GetActivePGPKeys(false)

	if index.Len() == 0 {
		m.Debug("no private gpg keys found")
		return nil, e.newGPGMatchErr(kfKeys)
	}

	// iterate through pgp keys in keyfamily
	var matches []*libkb.GpgPrimaryKey
	for _, kfKey := range kfKeys {
		// find matches in gpg index
		gpgKeys := index.Fingerprints.Get(kfKey.GetFingerprint().String())
		if len(gpgKeys) > 0 {
			matches = append(matches, gpgKeys...)
		}
	}

	if len(matches) == 0 {
		// if none exist, then abort with error that they need to get
		// the private key for one of the pgp keys in the keyfamily
		// onto this device.
		m.Debug("no matching private gpg keys found")
		return nil, e.newGPGMatchErr(kfKeys)
	}

	return matches, nil
}

func (e *loginProvision) newGPGMatchErr(keys []*libkb.PGPKeyBundle) error {
	fps := make([]string, len(keys))
	for i, k := range keys {
		fps[i] = k.GetFingerprint().ToQuads()
	}
	return libkb.NoMatchingGPGKeysError{Fingerprints: fps, HasActiveDevice: e.hasDevice}
}

func (e *loginProvision) gpgSignKey(m libkb.MetaContext, fp *libkb.PGPFingerprint) (libkb.GenericKey, error) {
	kf := e.arg.User.GetComputedKeyFamily()
	if kf == nil {
		return nil, libkb.KeyFamilyError{Msg: "no key family for user"}
	}
	kid, err := kf.FindKIDFromFingerprint(*fp)
	if err != nil {
		return nil, err
	}

	// create a GPGKey shell around gpg cli with fp, kid
	return libkb.NewGPGKey(m.G(), fp, kid, m.UIs().GPGUI, e.arg.ClientType), nil
}

func (e *loginProvision) gpgImportKey(m libkb.MetaContext, fp *libkb.PGPFingerprint) (libkb.GenericKey, error) {

	// import it with gpg
	cli, err := e.gpgClient(m)
	if err != nil {
		return nil, err
	}

	tty, err := m.UIs().GPGUI.GetTTY(m.Ctx())
	if err != nil {
		m.Warning("error getting TTY for GPG: %s", err)
		err = nil
	}

	bundle, err := cli.ImportKey(true, *fp, tty)
	if err != nil {
		return nil, err
	}

	// unlock it
	if err := bundle.Unlock(m, "sign new device", m.UIs().SecretUI); err != nil {
		return nil, err
	}

	return bundle, nil
}

func (e *loginProvision) makeEldestDevice(m libkb.MetaContext) error {
	args, err := e.makeDeviceWrapArgs(m)
	if err != nil {
		return err
	}
	args.IsEldest = true

	if err = e.makeDeviceKeys(m, args); err != nil {
		return err
	}
	e.saveToSecretStore(m)

	if cErr := libkb.ClearPwhashEddsaPassphraseStream(m, e.arg.User.GetNormalizedName()); cErr != nil {
		m.Debug("ClearPwhashEddsaPassphraseStream failed with: %s", cErr)
	}

	return nil
}

// This is used by SaltpackDecrypt as well.
func getPaperKey(m libkb.MetaContext, lastErr error, expectedPrefix *string) (keys *libkb.DeviceWithKeys, prefix string, err error) {
	passphrase, err := libkb.GetPaperKeyPassphrase(m, m.UIs().SecretUI, "", lastErr, expectedPrefix)
	if err != nil {
		return nil, "", err
	}

	return getPaperKeyFromString(m, passphrase)
}

func getPaperKeyFromString(m libkb.MetaContext, passphrase string) (keys *libkb.DeviceWithKeys, prefix string, err error) {
	paperPhrase, err := libkb.NewPaperKeyPhraseCheckVersion(m, passphrase)
	if err != nil {
		return nil, "", err
	}
	prefix = paperPhrase.Prefix()

	bkarg := &PaperKeyGenArg{
		Passphrase: paperPhrase,
		SkipPush:   true,
	}
	bkeng := NewPaperKeyGen(m.G(), bkarg)
	if err := RunEngine2(m, bkeng); err != nil {
		return nil, prefix, err
	}
	keys = bkeng.DeviceWithKeys()
	return keys, prefix, nil
}

func (e *loginProvision) fetchLKS(m libkb.MetaContext, encKey libkb.GenericKey) error {
	gen, clientLKS, err := fetchLKS(m, encKey)
	if err != nil {
		return err
	}
	e.lks = libkb.NewLKSecWithClientHalf(clientLKS, gen, e.arg.User.GetUID())
	return nil
}

func (e *loginProvision) hasPerUserKey(m libkb.MetaContext) (bool, error) {
	if e.arg.User == nil {
		return false, errors.New("no user object in arg")
	}
	return len(e.arg.User.ExportToUserPlusKeys().PerUserKeys) > 0, nil
}

func (e *loginProvision) displaySuccess(m libkb.MetaContext) error {
	if len(e.username) == 0 && e.arg.User != nil {
		e.username = e.arg.User.GetName()
	}
	sarg := keybase1.ProvisioneeSuccessArg{
		Username:   e.username,
		DeviceName: e.devname,
	}
	return m.UIs().ProvisionUI.ProvisioneeSuccess(m.Ctx(), sarg)
}

func (e *loginProvision) LoggedIn() bool {
	return !e.skippedLogin
}
func (e *loginProvision) AccountReset() bool {
	return e.resetComplete
}

var devtypeSortOrder = map[string]int{libkb.DeviceTypeMobile: 0, libkb.DeviceTypeDesktop: 1, libkb.DeviceTypePaper: 2}

type partitionDeviceList []*libkb.Device

func (p partitionDeviceList) Len() int {
	return len(p)
}

func (p partitionDeviceList) Less(a, b int) bool {
	if p[a].Type != p[b].Type {
		return devtypeSortOrder[p[a].Type] < devtypeSortOrder[p[b].Type]
	}
	return *p[a].Description < *p[b].Description
}

func (p partitionDeviceList) Swap(a, b int) {
	p[a], p[b] = p[b], p[a]
}

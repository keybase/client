package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
)

type SelfProvisionEngine struct {
	libkb.Contextified
	DeviceName     string
	result         error
	lks            *libkb.LKSec
	User           *libkb.User
	perUserKeyring *libkb.PerUserKeyring
	ekReboxer      *ephemeralKeyReboxer

	deviceWrapEng *DeviceWrap
}

// If a device is cloned, we can provision a new device from the current device
// to get out of the cloned state.
func NewSelfProvisionEngine(g *libkb.GlobalContext, deviceName string) *SelfProvisionEngine {
	return &SelfProvisionEngine{
		Contextified: libkb.NewContextified(g),
		DeviceName:   deviceName,
	}
}

func (e *SelfProvisionEngine) Name() string {
	return "SelfProvision"
}

func (e *SelfProvisionEngine) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *SelfProvisionEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.ProvisionUIKind,
		libkb.LogUIKind,
		libkb.SecretUIKind,
		libkb.LoginUIKind,
	}
}

func (e *SelfProvisionEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&loginLoadUser{},
	}
}

func (e *SelfProvisionEngine) Result() error {
	return e.result
}

func (e *SelfProvisionEngine) Run(m libkb.MetaContext) (err error) {
	m.G().LocalSigchainGuard().Set(m.Ctx(), "SelfProvisionEngine")
	defer m.G().LocalSigchainGuard().Clear(m.Ctx(), "SelfProvisionEngine")
	defer m.Trace("SelfProvisionEngine#Run", func() error { return err })()

	if d, err := libkb.GetDeviceCloneState(m); err != nil {
		return err
	} else if !d.IsClone() {
		return fmt.Errorf("to self provision, you must be a cloned device")
	}

	if err = m.G().SecretStore().PrimeSecretStores(m); err != nil {
		return SecretStoreNotFunctionalError{err}
	}

	uv, _ := e.G().ActiveDevice.GetUsernameAndUserVersionIfValid(m)
	// Pass the UV here so the passphrase stream is cached on the provisional
	// login context
	m = m.WithNewProvisionalLoginContextForUserVersionAndUsername(uv, e.G().Env.GetUsername())

	// From this point on, if there's an error, we abort the transaction.
	defer func() {
		if err == nil {
			// cache the passphrase stream from the login context to the active
			// device.
			m.CommitProvisionalLogin()
		}
	}()

	keys, err := e.loadUserAndActiveDeviceKeys(m)
	if err != nil {
		return err
	}

	e.ekReboxer = newEphemeralKeyReboxer()

	// Make new device keys and sign them with current device keys
	if err := e.provision(m, keys); err != nil {
		return err
	}

	// Finish provisoning by calling SwitchConfigAndActiveDevice. we
	// can't undo that, so do not error out after that.
	if err := e.deviceWrapEng.SwitchConfigAndActiveDevice(m); err != nil {
		return err
	}

	// Cleanup EKs belonging to the old device.
	if deviceEKStorage := m.G().GetDeviceEKStorage(); deviceEKStorage != nil {
		if err = deviceEKStorage.ForceDeleteAll(m, e.User.GetNormalizedName()); err != nil {
			m.Debug("unable to remove old ephemeral keys: %v", err)
		}
	}

	// Store and encrypt the new deviceEK with the new globally set
	// active device.
	if e.ekReboxer.storeEKs(m); err != nil {
		m.Debug("unable to store ephemeral keys: %v", err)
	}

	verifyLocalStorage(m, e.User.GetNormalizedName().String(), e.User.GetUID())
	if err := e.syncSecretStore(m); err != nil {
		m.Debug("unable to syncSecretStore: %v", err)
	}

	e.clearCaches(m)
	e.sendNotification(m)
	return nil
}

func (e *SelfProvisionEngine) loadUserAndActiveDeviceKeys(m libkb.MetaContext) (*libkb.DeviceWithKeys, error) {
	// run the LoginLoadUser sub-engine to load a user
	ueng := newLoginLoadUser(e.G(), e.G().Env.GetUsername().String())
	if err := RunEngine2(m, ueng); err != nil {
		return nil, err
	}
	e.User = ueng.User()
	pukRing, err := libkb.NewPerUserKeyring(e.G(), e.User.GetUID())
	if err != nil {
		return nil, err
	}
	e.perUserKeyring = pukRing

	activeDevice := e.G().ActiveDevice
	encKey, err := activeDevice.EncryptionKey()
	if err != nil {
		return nil, err
	}
	sigKey, err := activeDevice.SigningKey()
	if err != nil {
		return nil, err
	}
	keys := libkb.NewDeviceWithKeysOnly(sigKey, encKey)
	if _, err := keys.Populate(m); err != nil {
		return nil, err
	}

	return keys, nil
}

func (e *SelfProvisionEngine) provision(m libkb.MetaContext, keys *libkb.DeviceWithKeys) error {
	// Set the active device to be a special provisional key active device,
	// which keeps a cached copy around for DeviceKeyGen, which requires it to
	// be in memory.  It also will establish a NIST so that API calls can
	// proceed on behalf of the user.
	m = m.WithProvisioningKeyActiveDevice(keys, e.User.ToUserVersion())

	// need lksec to store device keys locally
	if err := e.fetchLKS(m, keys.EncryptionKey()); err != nil {
		return err
	}
	return e.makeDeviceKeysWithSigner(m, keys.SigningKey())
}

// copied from loginProvision
func (e *SelfProvisionEngine) fetchLKS(m libkb.MetaContext, encKey libkb.GenericKey) error {
	gen, clientLKS, err := fetchLKS(m, encKey)
	if err != nil {
		return err
	}
	e.lks = libkb.NewLKSecWithClientHalf(clientLKS, gen, e.User.GetUID())
	return nil
}

// makeDeviceKeysWithSigner creates device keys given a signing key.
func (e *SelfProvisionEngine) makeDeviceKeysWithSigner(m libkb.MetaContext, signer libkb.GenericKey) error {
	if err := e.ensureLKSec(m); err != nil {
		return err
	}

	_, _, deviceType, err := m.G().GetUPAKLoader().LookupUsernameAndDevice(m.Ctx(), e.User.GetUID(), e.G().ActiveDevice.DeviceID())
	if err != nil {
		return err
	}

	args := &DeviceWrapArgs{
		Me:              e.User,
		DeviceName:      e.DeviceName,
		DeviceType:      deviceType,
		Lks:             e.lks,
		IsEldest:        false, // just to be explicit
		IsSelfProvision: true,
		PerUserKeyring:  e.perUserKeyring,
		EldestKID:       e.User.GetEldestKID(),
		Signer:          signer,
		EkReboxer:       e.ekReboxer,
	}

	e.deviceWrapEng = NewDeviceWrap(m.G(), args)
	return RunEngine2(m, e.deviceWrapEng)
}

// copied from loginProvision
// ensureLKSec ensures we have LKSec for saving device keys.
func (e *SelfProvisionEngine) ensureLKSec(m libkb.MetaContext) error {
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
func (e *SelfProvisionEngine) ppStream(m libkb.MetaContext) (*libkb.PassphraseStream, error) {
	if m.LoginContext() == nil {
		return nil, errors.New("SelfProvisionEngine: ppStream() -> nil ctx.LoginContext")
	}
	cached := m.LoginContext().PassphraseStreamCache()
	if cached == nil {
		return nil, errors.New("SelfProvisionEngine: ppStream() -> nil PassphraseStreamCache")
	}
	return cached.PassphraseStream(), nil
}

func (e *SelfProvisionEngine) syncSecretStore(m libkb.MetaContext) error {
	// now store the secrets for our new device
	encKey, err := m.ActiveDevice().EncryptionKey()
	if err != nil {
		return err
	}
	if err := e.fetchLKS(m, encKey); err != nil {
		return err
	}

	// Get the LKS server half.
	if err := e.lks.Load(m); err != nil {
		return err
	}

	options := libkb.LoadAdvisorySecretStoreOptionsFromRemote(m)
	return libkb.StoreSecretAfterLoginWithLKSWithOptions(m, e.User.GetNormalizedName(), e.lks, &options)
}

func (e *SelfProvisionEngine) clearCaches(mctx libkb.MetaContext) {
	// Any caches that are encrypted with the old device key should be cleared
	// out here so we can re-populate and encrypt with the new key.
	if _, err := e.G().LocalChatDb.Nuke(); err != nil {
		mctx.Debug("unable to nuke LocalChatDb: %v", err)
	}
	if ekLib := e.G().GetEKLib(); ekLib != nil {
		ekLib.ClearCaches(mctx)
	}
}

func (e *SelfProvisionEngine) sendNotification(m libkb.MetaContext) {
	e.G().KeyfamilyChanged(m.Ctx(), e.User.GetUID())
	e.G().NotifyRouter.HandleLogin(m.Ctx(), string(e.G().Env.GetUsername()))
}

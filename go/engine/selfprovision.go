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

func (e *SelfProvisionEngine) Run(m libkb.MetaContext) (err error) {
	m.G().LocalSigchainGuard().Set(m.Ctx(), "selfProvision")
	defer m.G().LocalSigchainGuard().Clear(m.Ctx(), "selfProvision")
	defer m.CTrace("SelfProvisionEngine#Run", func() error { return err })()

	if d, err := libkb.GetDeviceCloneState(m); err != nil {
		return err
	} else if !d.IsClone() {
		return fmt.Errorf("to self provision, you must be a cloned device")
	}

	// transaction around config file
	tx, err := e.G().Env.GetConfigWriter().BeginTransaction()
	if err != nil {
		return err
	}

	// If we abort, we need to revert to the old active device and user config
	// state
	uv, _ := e.G().ActiveDevice.GetUsernameAndUserVersionIfValid(m)
	// Pass the UV here so the passphrase stream is cached on the provisional
	// login context
	m = m.WithNewProvisionalLoginContextForUserVersionAndUsername(uv, e.G().Env.GetUsername())

	// From this point on, if there's an error, we abort
	// the transaction.
	defer func() {
		if tx != nil {
			tx.Abort()
		}
		if err == nil {
			m = m.CommitProvisionalLogin()
		}
	}()

	// run the LoginLoadUser sub-engine to load a user
	ueng := newLoginLoadUser(e.G(), e.G().Env.GetUsername().String())
	if err = RunEngine2(m, ueng); err != nil {
		return err
	}
	e.User = ueng.User()

	activeDevice := e.G().ActiveDevice
	encKey, err := activeDevice.EncryptionKey()
	if err != nil {
		return err
	}
	sigKey, err := activeDevice.SigningKey()
	if err != nil {
		return err
	}
	keys := libkb.NewDeviceWithKeysOnly(sigKey, encKey)
	if _, err := keys.Populate(m); err != nil {
		return err
	}

	e.perUserKeyring, err = libkb.NewPerUserKeyring(e.G(), e.User.GetUID())
	if err != nil {
		return err
	}
	// Make new device keys and sign them with current device keys
	if err = e.provision(m, keys); err != nil {
		return err
	}
	// commit the config changes
	if err := tx.Commit(); err != nil {
		return err
	}
	// Zero out the TX so that we don't abort it in the defer()
	// exit.
	tx = nil

	if err := verifyLocalStorage(m, e.User.GetNormalizedName().String(), e.User.GetUID()); err != nil {
		return err
	}

	e.clearCaches(m)
	e.sendNotification()
	return nil
}

func (e *SelfProvisionEngine) provision(m libkb.MetaContext, keys *libkb.DeviceWithKeys) error {
	// After obtaining login session, this will be called before the login
	// state is released.  It signs this new device with the current device.
	u := e.User
	uv := u.ToUserVersion()

	// Set the active device to be a special provisional key active device,
	// which keeps a cached copy around for DeviceKeyGen, which requires it to
	// be in memory.  It also will establish a NIST so that API calls can
	// proceed on behalf of the user.
	m = m.WithProvisioningKeyActiveDevice(keys, uv)

	// need lksec to store device keys locally
	if err := e.fetchLKS(m, keys.EncryptionKey()); err != nil {
		return err
	}
	if err := e.makeDeviceKeysWithSigner(m, keys.SigningKey()); err != nil {
		return err
	}
	/// to helper
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
	m.CDebugf("Got LKS full")

	secretStore := libkb.NewSecretStore(m.G(), e.User.GetNormalizedName())
	m.CDebugf("Got secret store")

	// Extract the LKS secret
	secret, err := e.lks.GetSecret(m)
	if err != nil {
		return err
	}
	m.CDebugf("Got LKS secret")

	if err = secretStore.StoreSecret(m, secret); err != nil {
		return err
	}
	m.CDebugf("Stored secret with LKS from new device key")

	// Remove our provisional active device, and fall back to global device
	m = m.WithGlobalActiveDevice()
	return nil
}

func (e *SelfProvisionEngine) clearCaches(m libkb.MetaContext) {
	// Any caches that are encrypted with the old device key should be cleared
	// out here so we can re-populate and encrypt with the new key.
	if _, err := e.G().LocalChatDb.Nuke(); err != nil {
		m.CDebugf("unable to nuke LocalChatDb: %v", err)
	}
	if ekLib := e.G().GetEKLib(); ekLib != nil {
		ekLib.ClearCaches()
	}
}

func (e *SelfProvisionEngine) sendNotification() {
	e.G().KeyfamilyChanged(e.User.GetUID())
	e.G().NotifyRouter.HandleLogin(string(e.G().Env.GetUsername()))
}

func (e *SelfProvisionEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&loginLoadUser{},
	}
}

func (e *SelfProvisionEngine) Result() error {
	return e.result
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
	args, err := e.makeDeviceWrapArgs(m)
	if err != nil {
		return err
	}
	args.Signer = signer

	eng := NewDeviceWrap(m.G(), args)
	return RunEngine2(m, eng)
}

// makeDeviceWrapArgs creates a base set of args for DeviceWrap.  It ensures
// that LKSec is created.  It also gets a new device name for this device.
func (e *SelfProvisionEngine) makeDeviceWrapArgs(m libkb.MetaContext) (*DeviceWrapArgs, error) {
	if err := e.ensureLKSec(m); err != nil {
		return nil, err
	}

	ss, err := m.ActiveDevice().SyncSecrets(m)
	if err != nil {
		return nil, err
	}
	dev, err := ss.FindDevice(m.ActiveDevice().DeviceID())
	if err != nil {
		return nil, err
	}

	return &DeviceWrapArgs{
		Me:              e.User,
		DeviceName:      e.DeviceName,
		DeviceType:      dev.Type,
		Lks:             e.lks,
		IsEldest:        false, // just to be explicit
		IsSelfProvision: true,
		PerUserKeyring:  e.perUserKeyring,
		EldestKID:       e.User.GetEldestKID(),
	}, nil
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
		return nil, errors.New("loginProvision: ppStream() -> nil ctx.LoginContext")
	}
	cached := m.LoginContext().PassphraseStreamCache()
	if cached == nil {
		return nil, errors.New("loginProvision: ppStream() -> nil PassphraseStreamCache")
	}
	return cached.PassphraseStream(), nil
}

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
	// TODO what is the right way to get the passphrase stream cache setup?
	pps  *libkb.PassphraseStream
	tsec libkb.Triplesec
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

	uvOld, deviceIDOld, deviceNameOld, sigKeyOld, encKeyOld := e.G().ActiveDevice.AllFields()
	m = m.WithNewProvisionalLoginContext()

	// From this point on, if there's an error, we abort
	// the transaction.
	defer func() {
		if tx != nil {
			tx.Abort()
		}
		if err != nil {
			m.CDebugf("Error in self provision, reverting to original active device: %v", err)
			m = m.WithGlobalActiveDevice()
			salt, err := e.User.GetSalt()
			if err != nil {
				m.CDebugf("unable to GetSalt: %v", err)
				return
			}
			if err = m.SwitchUserNewConfig(e.User.GetUID(), e.User.GetNormalizedName(), salt, deviceIDOld); err != nil {
				m.CDebugf("unable to SwitchUserNewConfig: %v", err)
				return
			}
			if err := m.SetActiveDevice(uvOld, deviceIDOld, sigKeyOld, encKeyOld, deviceNameOld); err != nil {
				m.CDebugf("unable to SetActiveDevice: %v", err)
			}
		} else {
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

	verifyLocalStorage(m, e.User.GetNormalizedName().String(), e.User.GetUID())

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

func (e *SelfProvisionEngine) provision(m libkb.MetaContext, keys *libkb.DeviceWithKeys) error {
	// After obtaining login session, this will be called before the login state is released.
	// It signs this new device with the current device.
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
	m = m.WithGlobalActiveDevice()
	m.ActiveDevice().CacheProvisioningKey(m, keys)
	return nil
}

func (e *SelfProvisionEngine) sendNotification() {
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

	return e.makeDeviceKeys(m, args)
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

// makeDeviceKeys uses DeviceWrap to generate device keys.
func (e *SelfProvisionEngine) makeDeviceKeys(m libkb.MetaContext, args *DeviceWrapArgs) error {
	eng := NewDeviceWrap(m.G(), args)
	if err := RunEngine2(m, eng); err != nil {
		return err
	}

	// Sync the LKS stuff back from the server, so that subsequent
	// attempts to use public key login will work.
	if err := m.LoginContext().RunSecretSyncer(m, e.User.GetUID()); err != nil {
		return err
	}
	return nil
}

// copied from loginProvision
// ensureLKSec ensures we have LKSec for saving device keys.
func (e *SelfProvisionEngine) ensureLKSec(m libkb.MetaContext) error {
	if e.lks != nil {
		return nil
	}

	var err error
	e.pps, e.tsec, err = e.ppStream(m)
	if err != nil {
		return err
	}

	e.lks = libkb.NewLKSec(e.pps, e.User.GetUID())
	return nil
}

// copied from loginProvision
// ppStream gets the passphrase stream from the cache
func (e *SelfProvisionEngine) ppStream(m libkb.MetaContext) (*libkb.PassphraseStream, libkb.Triplesec, error) {
	if m.LoginContext() == nil {
		return nil, nil, errors.New("loginProvision: ppStream() -> nil ctx.LoginContext")
	}
	cached := m.LoginContext().PassphraseStreamCache()
	if cached == nil {
		return nil, nil, errors.New("loginProvision: ppStream() -> nil PassphraseStreamCache")
	}
	pps, tsec := cached.PassphraseStreamAndTriplesec()
	return pps, tsec, nil
}

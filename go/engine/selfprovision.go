package engine

import (
	"errors"
	"fmt"
	"os"

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
	defer m.CTrace("SelfProvisionEngine#Run", func() error { return err })()

	// Make sure we are in the cloned state.
	// TODO

	// transaction around config file
	tx, err := e.G().Env.GetConfigWriter().BeginTransaction()
	if err != nil {
		return err
	}

	m = m.WithNewProvisionalLoginContext()

	// From this point on, if there's an error, we abort the
	// transaction.
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

// copied from loginProvision
// makeDeviceKeysWithSigner creates device keys given a signing
// key.
func (e *SelfProvisionEngine) makeDeviceKeysWithSigner(m libkb.MetaContext, signer libkb.GenericKey) error {
	args, err := e.makeDeviceWrapArgs(m)
	if err != nil {
		return err
	}
	args.Signer = signer

	return e.makeDeviceKeys(m, args)
}

// copied from loginProvision
// makeDeviceWrapArgs creates a base set of args for DeviceWrap.
// It ensures that LKSec is created.  It also gets a new device
// name for this device.
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
// makeDeviceKeys uses DeviceWrap to generate device keys.
func (e *SelfProvisionEngine) makeDeviceKeys(m libkb.MetaContext, args *DeviceWrapArgs) error {
	eng := NewDeviceWrap(m.G(), args)
	return RunEngine2(m, eng)
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

func (e *SelfProvisionEngine) verifyLocalStorage(m libkb.MetaContext) {
	m.CDebugf("loginProvision: verifying local storage")
	defer m.CDebugf("loginProvision: done verifying local storage")
	normUsername := e.G().Env.GetUsername()

	// check config.json looks ok
	e.verifyRegularFile(m, "config", m.G().Env.GetConfigFilename())
	cr := m.G().Env.GetConfig()
	if cr.GetUsername() != normUsername {
		m.CDebugf("loginProvision(verify): config username %q doesn't match engine username %q", cr.GetUsername(), normUsername)
	}
	if cr.GetUID().NotEqual(e.User.GetUID()) {
		m.CDebugf("loginProvision(verify): config uid %q doesn't match engine uid %q", cr.GetUID(), e.User.GetUID())
	}

	// check session.json is valid
	e.verifyRegularFile(m, "session", m.G().Env.GetSessionFilename())

	// check keys in secretkeys.mpack
	e.verifyRegularFile(m, "secretkeys", m.G().SKBFilenameForUser(normUsername))

	// check secret stored
	secret, err := m.G().SecretStore().RetrieveSecret(m, normUsername)
	if err != nil {
		m.CDebugf("loginProvision(verify): failed to retrieve secret for %s: %s", normUsername, err)
	}
	if secret.IsNil() || len(secret.Bytes()) == 0 {
		m.CDebugf("loginProvision(verify): retrieved nil/empty secret for %s", normUsername)
	}
}

func (e *SelfProvisionEngine) verifyRegularFile(m libkb.MetaContext, name, filename string) {
	info, err := os.Stat(filename)
	if err != nil {
		m.CDebugf("loginProvision(verify): stat %s file %q error: %s", name, filename, err)
		return
	}

	m.CDebugf("loginProvision(verify): %s file %q size: %d", name, filename, info.Size())
	if !info.Mode().IsRegular() {
		m.CDebugf("loginProvision(verify): %s file %q not regular: %s", name, filename, info.Mode())
	}
}

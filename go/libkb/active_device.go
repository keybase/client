package libkb

import (
	"errors"
	"fmt"
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type ActiveDevice struct {
	uv            keybase1.UserVersion
	deviceID      keybase1.DeviceID
	deviceName    string
	deviceCtime   keybase1.Time
	signingKey    GenericKey   // cached secret signing key
	encryptionKey GenericKey   // cached secret encryption key
	nistFactory   *NISTFactory // Non-Interactive Session Token
	secretSyncer  *SecretSyncer
	passphrase    *PassphraseStreamCache
	// This can be a paper key or a regular device key if we are self
	// provisioning.
	provisioningKey         *SelfDestructingDeviceWithKeys
	secretPromptCancelTimer CancelTimer
	keychainMode            KeychainMode
	sync.RWMutex
}

func (a *ActiveDevice) Dump(m MetaContext, prefix string) {
	m.Debug("%sActiveDevice: %p", prefix, a)
	m.Debug("%sUserVersion: %+v", prefix, a.uv)
	m.Debug("%sUsername (via env): %s", prefix, a.Username(m))
	m.Debug("%sDeviceID: %s", prefix, a.deviceID)
	m.Debug("%sDeviceName: %s", prefix, a.deviceName)
	m.Debug("%sDeviceCtime: %s", prefix, keybase1.FormatTime(a.deviceCtime))
	if a.signingKey != nil {
		m.Debug("%sSigKey: %s", prefix, a.signingKey.GetKID())
	}
	if a.encryptionKey != nil {
		m.Debug("%sEncKey: %s", prefix, a.encryptionKey.GetKID())
	}
	m.Debug("%sPassphraseCache: cacheObj=%v; valid=%v", prefix, (a.passphrase != nil), (a.passphrase != nil && a.passphrase.ValidPassphraseStream()))
	m.Debug("%sProvisioningKeyCache: %v", prefix, (a.provisioningKey != nil && a.provisioningKey.DeviceWithKeys() != nil))
	m.Debug("%sKeychainMode: %v", prefix, a.keychainMode)
}

// NewProvisionalActiveDevice creates an ActiveDevice that is "provisional", in
// that it should not be considered the global ActiveDevice. Instead, it should
// reside in thread-local context, and can be weaved through the login
// machinery without trampling the actual global ActiveDevice.
func NewProvisionalActiveDevice(m MetaContext, uv keybase1.UserVersion, d keybase1.DeviceID, sigKey GenericKey, encKey GenericKey, deviceName string, keychainMode KeychainMode) *ActiveDevice {
	return &ActiveDevice{
		uv:            uv,
		deviceID:      d,
		deviceName:    deviceName,
		signingKey:    sigKey,
		encryptionKey: encKey,
		nistFactory:   NewNISTFactory(m.G(), uv.Uid, d, sigKey),
		secretSyncer:  NewSecretSyncer(m.G()),
		keychainMode:  keychainMode,
	}
}

func NewActiveDevice() *ActiveDevice {
	return &ActiveDevice{}
}

func NewProvisioningKeyActiveDevice(m MetaContext, uv keybase1.UserVersion, d *DeviceWithKeys) *ActiveDevice {
	ret := NewActiveDeviceWithDeviceWithKeys(m, uv, d)
	ret.provisioningKey = NewSelfDestructingDeviceWithKeys(m, d, ProvisioningKeyMemoryTimeout)
	return ret
}

func NewActiveDeviceWithDeviceWithKeys(m MetaContext, uv keybase1.UserVersion, d *DeviceWithKeys) *ActiveDevice {
	return &ActiveDevice{
		uv:            uv,
		deviceID:      d.deviceID,
		deviceName:    d.deviceName,
		signingKey:    d.signingKey,
		encryptionKey: d.encryptionKey,
		nistFactory:   NewNISTFactory(m.G(), uv.Uid, d.deviceID, d.signingKey),
		secretSyncer:  NewSecretSyncer(m.G()),
		keychainMode:  d.keychainMode,
	}
}

func (a *ActiveDevice) ClearCaches() {
	a.Lock()
	defer a.Unlock()
	a.passphrase = nil
	a.provisioningKey = nil
	a.secretPromptCancelTimer.Reset()
}

// Copy ActiveDevice info from the given ActiveDevice.
func (a *ActiveDevice) Copy(m MetaContext, src *ActiveDevice) error {

	// Take a consistent snapshot of the src device. Be careful not to hold
	// locks on both devices at once.
	src.Lock()
	uv := src.uv
	deviceID := src.deviceID
	sigKey := src.signingKey
	encKey := src.encryptionKey
	name := src.deviceName
	ctime := src.deviceCtime
	keychainMode := src.keychainMode
	src.Unlock()

	return a.Set(m, uv, deviceID, sigKey, encKey, name, ctime, keychainMode)
}

func (a *ActiveDevice) SetOrClear(m MetaContext, a2 *ActiveDevice) error {
	// Always clear, if we are also setting we set all new values.
	err := a.Clear()
	if err != nil {
		return err
	}
	if a2 == nil {
		return nil
	}
	return a.Copy(m, a2)
}

// Set acquires the write lock and sets all the fields in ActiveDevice.
// The acct parameter is not used for anything except to help ensure
// that this is called from inside a LoginState account request.
func (a *ActiveDevice) Set(m MetaContext, uv keybase1.UserVersion, deviceID keybase1.DeviceID,
	sigKey, encKey GenericKey, deviceName string, deviceCtime keybase1.Time, keychainMode KeychainMode) error {
	a.Lock()
	defer a.Unlock()

	if err := a.internalUpdateUserVersionDeviceID(uv, deviceID); err != nil {
		return err
	}

	a.signingKey = sigKey
	a.encryptionKey = encKey
	a.deviceName = deviceName
	a.deviceCtime = deviceCtime
	a.nistFactory = NewNISTFactory(m.G(), uv.Uid, deviceID, sigKey)
	a.secretSyncer = NewSecretSyncer(m.G())
	a.keychainMode = keychainMode

	return nil
}

func (a *ActiveDevice) KeychainMode() KeychainMode {
	a.Lock()
	defer a.Unlock()
	return a.keychainMode
}

// setSigningKey acquires the write lock and sets the signing key.
// The acct parameter is not used for anything except to help ensure
// that this is called from inside a LogingState account request.
func (a *ActiveDevice) setSigningKey(g *GlobalContext, uv keybase1.UserVersion, deviceID keybase1.DeviceID,
	sigKey GenericKey, deviceName string) error {
	a.Lock()
	defer a.Unlock()

	if err := a.internalUpdateUserVersionDeviceID(uv, deviceID); err != nil {
		return err
	}

	a.signingKey = sigKey
	if len(deviceName) > 0 {
		a.deviceName = deviceName
	}
	a.nistFactory = NewNISTFactory(g, uv.Uid, deviceID, sigKey)
	return nil
}

// setEncryptionKey acquires the write lock and sets the encryption key.
// The acct parameter is not used for anything except to help ensure
// that this is called from inside a LogingState account request.
func (a *ActiveDevice) setEncryptionKey(uv keybase1.UserVersion, deviceID keybase1.DeviceID, encKey GenericKey) error {
	a.Lock()
	defer a.Unlock()

	if err := a.internalUpdateUserVersionDeviceID(uv, deviceID); err != nil {
		return err
	}

	a.encryptionKey = encKey
	return nil
}

// should only called by the functions in this type, with the write lock.
func (a *ActiveDevice) internalUpdateUserVersionDeviceID(uv keybase1.UserVersion, deviceID keybase1.DeviceID) error {

	if uv.IsNil() {
		return errors.New("ActiveDevice.set with nil uid")
	}
	if deviceID.IsNil() {
		return errors.New("ActiveDevice.set with nil deviceID")
	}

	if a.uv.IsNil() && a.deviceID.IsNil() {
		a.uv = uv
		a.deviceID = deviceID
	} else if !a.uv.Eq(uv) {
		return errors.New("ActiveDevice.set uid mismatch")
	} else if !a.deviceID.Eq(deviceID) {
		return errors.New("ActiveDevice.set deviceID mismatch")
	}

	return nil
}

func (a *ActiveDevice) Clear() error {
	_, err := a.clear()
	return err
}

func (a *ActiveDevice) ClearGetKeychainMode() (KeychainMode, error) {
	return a.clear()
}

// Clear acquires the write lock and resets all the fields to zero values.
func (a *ActiveDevice) clear() (KeychainMode, error) {
	a.Lock()
	defer a.Unlock()

	a.uv = keybase1.UserVersion{}
	a.deviceID = ""
	a.deviceName = ""
	a.signingKey = nil
	a.encryptionKey = nil
	a.nistFactory = nil
	a.passphrase = nil
	a.provisioningKey = nil
	a.secretPromptCancelTimer.Reset()
	ret := a.keychainMode
	a.keychainMode = KeychainModeNone
	return ret, nil
}

func (a *ActiveDevice) SecretPromptCancelTimer() *CancelTimer {
	a.RLock()
	defer a.RUnlock()
	return &a.secretPromptCancelTimer
}

// UID returns the user ID that was provided when the device keys were cached.
// Safe for use by concurrent goroutines.
func (a *ActiveDevice) UID() keybase1.UID {
	a.RLock()
	defer a.RUnlock()
	return a.uv.Uid
}

func (a *ActiveDevice) UIDAndEncryptionKey() (keybase1.UID, GenericKey) {
	a.RLock()
	defer a.RUnlock()
	return a.uv.Uid, a.encryptionKey
}

func (a *ActiveDevice) UserVersion() keybase1.UserVersion {
	a.RLock()
	defer a.RUnlock()
	return a.uv
}

// Username tries to get the active user's username by looking into the current
// environment and mapping an UID to a username based on our config file. It
// won't work halfway through a provisioning.
func (a *ActiveDevice) Username(m MetaContext) NormalizedUsername {
	return m.G().Env.GetUsernameForUID(a.UID())
}

// DeviceID returns the device ID that was provided when the device keys were
// cached.  Safe for use by concurrent goroutines.
func (a *ActiveDevice) DeviceID() keybase1.DeviceID {
	a.RLock()
	defer a.RUnlock()
	return a.deviceID
}

func (a *ActiveDevice) DeviceType(mctx MetaContext) (string, error) {
	if a.secretSyncer.keys == nil {
		mctx.Debug("keys are not synced with the server for this ActiveDevice. lets do that right now")
		_, err := a.SyncSecretsForce(mctx)
		if err != nil {
			return "", err
		}
	}
	devices, err := a.secretSyncer.Devices()
	if err != nil {
		return "", err
	}
	for devID, dev := range devices {
		if devID == a.DeviceID() {
			return dev.Type, nil
		}
	}
	return "", NotFoundError{
		Msg: "Not found: device type",
	}
}

// SigningKey returns the signing key for the active device.
// Safe for use by concurrent goroutines.
func (a *ActiveDevice) SigningKey() (GenericKey, error) {
	a.RLock()
	defer a.RUnlock()
	if a.signingKey == nil {
		return nil, NotFoundError{
			Msg: "Not found: device signing key",
		}
	}
	return a.signingKey, nil
}

// SigningKeyWithUID returns the signing key for the active device.
// Returns an error if uid is not active.
// Safe for use by concurrent goroutines.
func (a *ActiveDevice) SigningKeyWithUID(uid keybase1.UID) (GenericKey, error) {
	a.RLock()
	defer a.RUnlock()
	if a.uv.Uid.IsNil() {
		return nil, NotFoundError{
			Msg: "Not found: device signing key (no active user)",
		}
	}
	if a.uv.Uid != uid {
		return nil, fmt.Errorf("device signing key for non-active user: %v != %v", a.uv.Uid, uid)
	}
	if a.signingKey == nil {
		return nil, NotFoundError{
			Msg: "Not found: device signing key",
		}
	}
	return a.signingKey, nil
}

// EncryptionKey returns the encryption key for the active device.
// Safe for use by concurrent goroutines.
func (a *ActiveDevice) EncryptionKey() (GenericKey, error) {
	a.RLock()
	defer a.RUnlock()
	if a.encryptionKey == nil {
		return nil, NotFoundError{
			Msg: "Not found: device encryption key",
		}
	}
	return a.encryptionKey, nil
}

// EncryptionKeyWithUID returns the encryption key for the active device.
// Returns an error if uid is not active.
// Safe for use by concurrent goroutines.
func (a *ActiveDevice) EncryptionKeyWithUID(uid keybase1.UID) (GenericKey, error) {
	a.RLock()
	defer a.RUnlock()
	if a.uv.Uid.IsNil() {
		return nil, NotFoundError{
			Msg: "Not found: device encryption key (no active user)",
		}
	}
	if a.uv.Uid != uid {
		return nil, fmt.Errorf("device encryption key for non-active user: %v != %v", a.uv.Uid, uid)
	}
	if a.encryptionKey == nil {
		return nil, NotFoundError{
			Msg: "Not found: device encryption key",
		}
	}
	return a.encryptionKey, nil
}

// NaclEncryptionKey returns the encryption key for the active device, as a
// NaclDHKeyPair. If the cast fails (though that should never happen), it
// returns an error.
func (a *ActiveDevice) NaclEncryptionKey() (*NaclDHKeyPair, error) {
	genericKey, err := a.EncryptionKey()
	if err != nil {
		return nil, err
	}
	naclKey, ok := genericKey.(NaclDHKeyPair)
	if !ok {
		return nil, fmt.Errorf("expected NaclDHKeyPair, got %T", genericKey)
	}
	return &naclKey, nil
}

// KeyByType returns a cached key based on SecretKeyType.
// Safe for use by concurrent goroutines.
func (a *ActiveDevice) KeyByType(t SecretKeyType) (GenericKey, error) {
	switch t {
	case DeviceSigningKeyType:
		return a.SigningKey()
	case DeviceEncryptionKeyType:
		return a.EncryptionKey()
	default:
		return nil, fmt.Errorf("Invalid type %v", t)
	}
}

// KeyByTypeWithUID is like KeyByType but returns an error if uid is not active.
// Safe for use by concurrent goroutines.
func (a *ActiveDevice) KeyByTypeWithUID(uid keybase1.UID, t SecretKeyType) (GenericKey, error) {
	switch t {
	case DeviceSigningKeyType:
		return a.SigningKeyWithUID(uid)
	case DeviceEncryptionKeyType:
		return a.EncryptionKeyWithUID(uid)
	default:
		return nil, fmt.Errorf("Invalid type %v", t)
	}
}

// AllFields returns all the ActiveDevice fields via one lock for consistency.
// Safe for use by concurrent goroutines.
func (a *ActiveDevice) AllFields() (uv keybase1.UserVersion, deviceID keybase1.DeviceID, deviceName string, sigKey GenericKey, encKey GenericKey) {
	a.RLock()
	defer a.RUnlock()

	return a.uv, a.deviceID, a.deviceName, a.signingKey, a.encryptionKey
}

func (a *ActiveDevice) Name() string {
	a.RLock()
	defer a.RUnlock()

	return a.deviceName
}

func (a *ActiveDevice) HaveKeys() bool {
	a.RLock()
	defer a.RUnlock()

	return a.signingKey != nil && a.encryptionKey != nil
}

func (a *ActiveDevice) Valid() bool {
	a.RLock()
	defer a.RUnlock()

	return a.valid()
}

func (a *ActiveDevice) valid() bool {
	return a.signingKey != nil && a.encryptionKey != nil && !a.uv.IsNil() && !a.deviceID.IsNil() && a.deviceName != ""
}

func (a *ActiveDevice) Ctime(m MetaContext) (keybase1.Time, error) {
	// make sure the device id doesn't change throughout this function
	deviceID := a.DeviceID()

	// check if we have a cached ctime already
	ctime, err := a.ctimeCached(deviceID)
	if err != nil {
		return 0, err
	}
	if ctime > 0 {
		return ctime, nil
	}

	// need to build a device and ask the server for ctimes
	decKeys, err := a.deviceKeys(deviceID)
	if err != nil {
		return 0, err
	}
	// Note: decKeys.Populate() makes a network API call
	if _, err := decKeys.Populate(m); err != nil {
		return 0, nil
	}

	// set the ctime value under a write lock
	a.Lock()
	defer a.Unlock()
	if !a.deviceID.Eq(deviceID) {
		return 0, errors.New("active device changed during ctime lookup")
	}
	a.deviceCtime = decKeys.DeviceCtime()

	return a.deviceCtime, nil
}

func (a *ActiveDevice) ctimeCached(deviceID keybase1.DeviceID) (keybase1.Time, error) {
	a.RLock()
	defer a.RUnlock()

	if !a.deviceID.Eq(deviceID) {
		return 0, errors.New("active device changed during ctime lookup")
	}

	return a.deviceCtime, nil
}

func (a *ActiveDevice) deviceKeys(deviceID keybase1.DeviceID) (*DeviceWithKeys, error) {
	a.RLock()
	defer a.RUnlock()

	if !a.valid() {
		return nil, errors.New("active device is not valid")
	}

	if !a.deviceID.Eq(deviceID) {
		return nil, errors.New("active device changed")
	}

	return NewDeviceWithKeysOnly(a.signingKey, a.encryptionKey, a.keychainMode), nil
}

func (a *ActiveDevice) DeviceKeys() (*DeviceWithKeys, error) {
	a.RLock()
	defer a.RUnlock()

	if !a.valid() {
		return nil, errors.New("active device is not valid")
	}
	return NewDeviceWithKeysOnly(a.signingKey, a.encryptionKey, a.keychainMode), nil
}

func (a *ActiveDevice) IsValidFor(uid keybase1.UID, deviceID keybase1.DeviceID) bool {
	a.RLock()
	defer a.RUnlock()
	if a.signingKey == nil || a.encryptionKey == nil {
		return false
	}
	if !uid.Equal(a.uv.Uid) {
		return false
	}
	if !deviceID.Eq(a.deviceID) {
		return false
	}
	return true
}

func (a *ActiveDevice) NIST(ctx context.Context) (*NIST, error) {
	a.RLock()
	defer a.RUnlock()
	return a.nistLocked(ctx)
}

func (a *ActiveDevice) NISTWebAuthToken(ctx context.Context) (*NIST, error) {
	a.RLock()
	defer a.RUnlock()
	return a.nistFactory.GenerateWebAuthToken(ctx)
}

func (a *ActiveDevice) nistLocked(ctx context.Context) (*NIST, error) {
	nist, err := a.nistFactory.NIST(ctx)
	if err != nil {
		return nil, err
	}
	if nist == nil {
		return nil, nil
	}
	uid := a.nistFactory.UID()
	if !uid.Equal(a.uv.Uid) {
		return nil, NewUIDMismatchError(fmt.Sprintf("NIST generation error, UIDs didn't match; ActiveDevice said %s, but NIST factory said %s", a.uv.Uid, uid))
	}

	return nist, nil
}

func (a *ActiveDevice) NISTAndUIDDeviceID(ctx context.Context) (*NIST, keybase1.UID, keybase1.DeviceID, error) {
	a.RLock()
	defer a.RUnlock()
	nist, err := a.nistLocked(ctx)
	return nist, a.uv.Uid, a.deviceID, err
}

func (a *ActiveDevice) SyncSecretsForUID(m MetaContext, u keybase1.UID, force bool) (ret *SecretSyncer, err error) {
	defer m.Trace("ActiveDevice#SyncSecretsForUID", func() error { return err })()

	a.RLock()
	s := a.secretSyncer
	uid := a.uv.Uid
	a.RUnlock()

	if !u.IsNil() && !uid.Equal(u) {
		return nil, fmt.Errorf("Wrong UID for sync secrets: %s != %s", uid, u)
	}
	if s == nil {
		return nil, fmt.Errorf("Can't sync secrets: nil secret syncer")
	}
	if uid.IsNil() {
		return nil, fmt.Errorf("can't run secret syncer without a UID")
	}
	if err = RunSyncer(m, s, uid, true, force); err != nil {
		return nil, err
	}
	return s, nil
}

func (a *ActiveDevice) SyncSecrets(m MetaContext) (ret *SecretSyncer, err error) {
	defer m.Trace("ActiveDevice#SyncSecrets", func() error { return err })()
	var zed keybase1.UID
	return a.SyncSecretsForUID(m, zed, false /* force */)
}

func (a *ActiveDevice) SyncSecretsForce(m MetaContext) (ret *SecretSyncer, err error) {
	defer m.Trace("ActiveDevice#SyncSecretsForce", func() error { return err })()
	var zed keybase1.UID
	return a.SyncSecretsForUID(m, zed, true /* force */)
}

func (a *ActiveDevice) CheckForUsername(m MetaContext, n NormalizedUsername, suppressNetworkErrors bool) (err error) {
	a.RLock()
	uid := a.uv.Uid
	deviceID := a.deviceID
	valid := a.valid()
	a.RUnlock()
	if !valid {
		return NoActiveDeviceError{}
	}
	return m.G().GetUPAKLoader().CheckDeviceForUIDAndUsername(m.Ctx(), uid, deviceID, n, suppressNetworkErrors)
}

func (a *ActiveDevice) ProvisioningKeyWrapper(m MetaContext) *SelfDestructingDeviceWithKeys {
	a.RLock()
	defer a.RUnlock()
	return a.provisioningKey
}

func (a *ActiveDevice) ProvisioningKey(m MetaContext) *DeviceWithKeys {
	a.RLock()
	defer a.RUnlock()
	if a.provisioningKey == nil {
		return nil
	}
	return a.provisioningKey.DeviceWithKeys()
}

func (a *ActiveDevice) ClearProvisioningKey(m MetaContext) {
	a.Lock()
	defer a.Unlock()
	a.provisioningKey = nil
}

func (a *ActiveDevice) CacheProvisioningKey(m MetaContext, k *DeviceWithKeys) {
	a.Lock()
	defer a.Unlock()
	a.provisioningKey = NewSelfDestructingDeviceWithKeys(m, k, ProvisioningKeyMemoryTimeout)
}

func (a *ActiveDevice) PassphraseStreamCache() *PassphraseStreamCache {
	a.RLock()
	defer a.RUnlock()
	return a.passphrase
}

func (a *ActiveDevice) PassphraseStream() *PassphraseStream {
	a.RLock()
	defer a.RUnlock()
	c := a.PassphraseStreamCache()
	if c == nil || !c.ValidPassphraseStream() {
		return nil
	}
	return c.PassphraseStream()
}

func (a *ActiveDevice) TriplesecAndGeneration() (Triplesec, PassphraseGeneration) {
	a.RLock()
	defer a.RUnlock()
	var zed PassphraseGeneration
	c := a.PassphraseStreamCache()
	if c == nil {
		return nil, zed
	}
	return c.TriplesecAndGeneration()
}

func (a *ActiveDevice) CachePassphraseStream(c *PassphraseStreamCache) {
	a.Lock()
	defer a.Unlock()
	a.passphrase = c
}

func (a *ActiveDevice) ClearPassphraseStreamCache() {
	a.Lock()
	defer a.Unlock()
	a.passphrase = nil
}

func (a *ActiveDevice) ClearPassphraseStreamCacheIfOutdated(mctx MetaContext) error {
	pps := a.PassphraseStream()
	if pps == nil {
		return nil
	}

	outdated, err := pps.SyncAndCheckIfOutdated(mctx)
	if err != nil {
		return err
	}

	if outdated {
		a.ClearPassphraseStreamCache()
	}
	return nil
}

func (a *ActiveDevice) SigningKeyForUID(u keybase1.UID) GenericKey {
	a.RLock()
	defer a.RUnlock()
	if !a.UID().Equal(u) {
		return nil
	}
	return a.signingKey
}

func (a *ActiveDevice) Keyring(m MetaContext) (ret *SKBKeyringFile, err error) {
	defer m.Trace("ActiveDevice#Keyring", func() error { return err })()
	un := a.Username(m)
	if un.IsNil() {
		return nil, NewNoUsernameError()
	}
	m.Debug("Account: loading keyring for %s", un)
	ret, err = LoadSKBKeyring(un, m.G())
	if err != nil {
		return nil, err
	}
	return ret, nil
}

func (a *ActiveDevice) CopyCacheToLoginContextIfForUserVersion(m MetaContext, lc LoginContext, uv keybase1.UserVersion) (err error) {
	defer m.Trace("ActiveDevice#CopyCacheToLoginContextIfForUID", func() error { return err })()
	a.RLock()
	defer a.RUnlock()
	if !a.uv.Eq(uv) {
		return NewUIDMismatchError(fmt.Sprintf("%s v %s", a.uv, uv))
	}
	if a.passphrase != nil {
		m.Debug("| copying non-nil passphrase cache")
		lc.SetStreamCache(a.passphrase)
	}
	return nil
}

func (a *ActiveDevice) GetUsernameAndUserVersionIfValid(m MetaContext) (uv keybase1.UserVersion, un NormalizedUsername) {
	a.RLock()
	defer a.RUnlock()
	if a.uv.IsNil() {
		return uv, un
	}
	un = m.G().Env.GetUsernameForUID(a.uv.Uid)
	if un.IsNil() {
		return keybase1.UserVersion{}, NormalizedUsername("")
	}
	return a.uv, un
}

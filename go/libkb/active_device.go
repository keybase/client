package libkb

import (
	"errors"
	"fmt"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
	"strings"
	"sync"
)

type ActiveDevice struct {
	uid           keybase1.UID
	deviceID      keybase1.DeviceID
	deviceName    string
	signingKey    GenericKey   // cached secret signing key
	encryptionKey GenericKey   // cached secret encryption key
	nistFactory   *NISTFactory // Non-Interactive Session Token
	secretSyncer  *SecretSyncer
	sync.RWMutex
}

// NewProvisionalActiveDevice creates an ActiveDevice that is "provisional", in that it
// should not be considered the global ActiveDevice. Instead, it should reside in thread-local
// context, and can be weaved through the login machinery without trampling the actual global
// ActiveDevice.
func NewProvisionalActiveDevice(m MetaContext, u keybase1.UID, d keybase1.DeviceID, sigKey GenericKey, encKey GenericKey, deviceName string) *ActiveDevice {
	return &ActiveDevice{
		uid:           u,
		deviceID:      d,
		deviceName:    deviceName,
		signingKey:    sigKey,
		encryptionKey: encKey,
		nistFactory:   NewNISTFactory(m.G(), u, d, sigKey),
		secretSyncer:  NewSecretSyncer(m.G()),
	}
}

// Set acquires the write lock and sets all the fields in ActiveDevice.
// The acct parameter is not used for anything except to help ensure
// that this is called from inside a LogingState account request.
func (a *ActiveDevice) Set(m MetaContext, uid keybase1.UID, deviceID keybase1.DeviceID, sigKey, encKey GenericKey, deviceName string) error {
	a.Lock()
	defer a.Unlock()

	if err := a.internalUpdateUIDDeviceID(m.LoginContext(), uid, deviceID); err != nil {
		return err
	}

	a.signingKey = sigKey
	a.encryptionKey = encKey
	a.deviceName = deviceName
	a.nistFactory = NewNISTFactory(m.G(), uid, deviceID, sigKey)
	a.secretSyncer = NewSecretSyncer(m.G())

	return nil
}

// setSigningKey acquires the write lock and sets the signing key.
// The acct parameter is not used for anything except to help ensure
// that this is called from inside a LogingState account request.
func (a *ActiveDevice) setSigningKey(g *GlobalContext, lctx LoginContext, uid keybase1.UID, deviceID keybase1.DeviceID, sigKey GenericKey) error {
	a.Lock()
	defer a.Unlock()

	if err := a.internalUpdateUIDDeviceID(lctx, uid, deviceID); err != nil {
		return err
	}

	a.signingKey = sigKey
	a.nistFactory = NewNISTFactory(g, uid, deviceID, sigKey)
	return nil
}

// setEncryptionKey acquires the write lock and sets the encryption key.
// The acct parameter is not used for anything except to help ensure
// that this is called from inside a LogingState account request.
func (a *ActiveDevice) setEncryptionKey(lctx LoginContext, uid keybase1.UID, deviceID keybase1.DeviceID, encKey GenericKey) error {
	a.Lock()
	defer a.Unlock()

	if err := a.internalUpdateUIDDeviceID(lctx, uid, deviceID); err != nil {
		return err
	}

	a.encryptionKey = encKey
	return nil
}

// setDeviceName acquires the write lock and sets the device name.
// The acct parameter is not used for anything except to help ensure
// that this is called from inside a LogingState account request.
func (a *ActiveDevice) setDeviceName(lctx LoginContext, uid keybase1.UID, deviceID keybase1.DeviceID, deviceName string) error {
	a.Lock()
	defer a.Unlock()

	if strings.TrimSpace(deviceName) == "" {
		return errors.New("no device name specified")
	}

	if err := a.internalUpdateUIDDeviceID(lctx, uid, deviceID); err != nil {
		return err
	}

	a.deviceName = deviceName
	return nil
}

// should only called by the functions in this type, with the write lock.
func (a *ActiveDevice) internalUpdateUIDDeviceID(lctx LoginContext, uid keybase1.UID, deviceID keybase1.DeviceID) error {

	// Ignore lctx

	if uid.IsNil() {
		return errors.New("ActiveDevice.set with nil uid")
	}
	if deviceID.IsNil() {
		return errors.New("ActiveDevice.set with nil deviceID")
	}

	if a.uid.IsNil() && a.deviceID.IsNil() {
		a.uid = uid
		a.deviceID = deviceID
	} else if a.uid.NotEqual(uid) {
		return errors.New("ActiveDevice.set uid mismatch")
	} else if !a.deviceID.Eq(deviceID) {
		return errors.New("ActiveDevice.set deviceID mismatch")
	}

	return nil
}

func (a *ActiveDevice) Clear(acct *Account) error {
	return a.clear(acct)
}

// Clear acquires the write lock and resets all the fields to zero values.
func (a *ActiveDevice) clear(acct *Account) error {
	a.Lock()
	defer a.Unlock()

	a.uid = ""
	a.deviceID = ""
	a.signingKey = nil
	a.encryptionKey = nil
	a.nistFactory = nil

	return nil
}

// UID returns the user ID that was provided when the device keys were cached.
// Safe for use by concurrent goroutines.
func (a *ActiveDevice) UID() keybase1.UID {
	a.RLock()
	defer a.RUnlock()
	return a.uid
}

// DeviceID returns the device ID that was provided when the device keys were cached.
// Safe for use by concurrent goroutines.
func (a *ActiveDevice) DeviceID() keybase1.DeviceID {
	a.RLock()
	defer a.RUnlock()
	return a.deviceID
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

// EncryptionKey returns the signing key for the active device.
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

// AllFields returns all the ActiveDevice fields via one lock for consistency.
// Safe for use by concurrent goroutines.
func (a *ActiveDevice) AllFields() (uid keybase1.UID, deviceID keybase1.DeviceID, deviceName string, sigKey GenericKey, encKey GenericKey) {
	a.RLock()
	defer a.RUnlock()

	return a.uid, a.deviceID, a.deviceName, a.signingKey, a.encryptionKey
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

	return a.signingKey != nil && a.encryptionKey != nil && !a.uid.IsNil() && !a.deviceID.IsNil() && a.deviceName != ""
}

func (a *ActiveDevice) IsValidFor(uid keybase1.UID, deviceID keybase1.DeviceID) bool {
	a.RLock()
	defer a.RUnlock()
	if a.signingKey == nil || a.encryptionKey == nil {
		return false
	}
	if !uid.Equal(a.uid) {
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
	return a.nistFactory.NIST(ctx)
}

func (a *ActiveDevice) NISTAndUID(ctx context.Context) (*NIST, keybase1.UID, error) {
	a.RLock()
	defer a.RUnlock()
	nist, err := a.nistFactory.NIST(ctx)
	return nist, a.uid, err
}

func (a *ActiveDevice) SyncSecrets(m MetaContext) (err error) {
	defer m.CTrace("ActiveDevice#SyncSecrets", func() error { return err })()

	a.RLock()
	s := a.secretSyncer
	uid := a.uid
	a.RUnlock()

	if s == nil {
		return fmt.Errorf("Can't sync secrets: nil secret syncer")
	}
	return RunSyncer(s, uid, true, nil)
}

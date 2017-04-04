package libkb

import (
	"errors"
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
)

type ActiveDevice struct {
	uid           keybase1.UID
	deviceID      keybase1.DeviceID
	signingKey    GenericKey // cached secret signing key
	encryptionKey GenericKey // cached secret encryption key
	sync.RWMutex
}

func (a *ActiveDevice) set(uid keybase1.UID, deviceID keybase1.DeviceID, sigKey, encKey GenericKey) error {
	a.Lock()
	defer a.Unlock()

	if err := a.internalUpdateUIDDeviceID(uid, deviceID); err != nil {
		return err
	}

	a.signingKey = sigKey
	a.encryptionKey = encKey

	return nil
}

func (a *ActiveDevice) setSigningKey(uid keybase1.UID, deviceID keybase1.DeviceID, sigKey GenericKey) error {
	a.Lock()
	defer a.Unlock()

	if err := a.internalUpdateUIDDeviceID(uid, deviceID); err != nil {
		return err
	}

	a.signingKey = sigKey
	return nil
}

func (a *ActiveDevice) setEncryptionKey(uid keybase1.UID, deviceID keybase1.DeviceID, encKey GenericKey) error {
	a.Lock()
	defer a.Unlock()

	if err := a.internalUpdateUIDDeviceID(uid, deviceID); err != nil {
		return err
	}

	a.encryptionKey = encKey
	return nil
}

// should only called by the functions in this type, with the write lock.
func (a *ActiveDevice) internalUpdateUIDDeviceID(uid keybase1.UID, deviceID keybase1.DeviceID) error {
	if a.uid.IsNil() && a.deviceID.IsNil() {
		a.uid = uid
		a.deviceID = deviceID
	} else if a.uid.NotEqual(uid) {
		return errors.New("ActiveDevice.setEncryptionKey uid mismatch")
	} else if !a.deviceID.Eq(deviceID) {
		return errors.New("ActiveDevice.setEncryptionKey deviceID mismatch")
	}

	return nil
}

func (a *ActiveDevice) clear() {
	a.Lock()
	defer a.Unlock()

	a.uid = ""
	a.deviceID = ""
	a.signingKey = nil
	a.encryptionKey = nil
}

func (a *ActiveDevice) UID() keybase1.UID {
	a.RLock()
	defer a.RUnlock()
	return a.uid
}

func (a *ActiveDevice) DeviceID() keybase1.DeviceID {
	a.RLock()
	defer a.RUnlock()
	return a.deviceID
}

func (a *ActiveDevice) SigningKey() GenericKey {
	a.RLock()
	defer a.RUnlock()
	return a.signingKey
}

func (a *ActiveDevice) EncryptionKey() GenericKey {
	a.RLock()
	defer a.RUnlock()
	return a.encryptionKey
}

func (a *ActiveDevice) AllFields() (uid keybase1.UID, deviceID keybase1.DeviceID, sigKey GenericKey, encKey GenericKey) {
	a.RLock()
	defer a.RUnlock()

	return a.uid, a.deviceID, a.signingKey, a.encryptionKey
}

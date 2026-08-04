package libkb

import (
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type KeychainMode int

const (
	KeychainModeNone   KeychainMode = 0
	KeychainModeOS     KeychainMode = 1
	KeychainModeMemory KeychainMode = 2
)

type DeviceWithKeys struct {
	signingKey    GenericKey
	encryptionKey GenericKey
	deviceID      keybase1.DeviceID
	deviceName    string
	deviceCtime   keybase1.Time
	keychainMode  KeychainMode
}

func NewDeviceWithKeys(signingKey, encryptionKey GenericKey, deviceID keybase1.DeviceID, deviceName string, keychainMode KeychainMode) *DeviceWithKeys {
	return &DeviceWithKeys{
		signingKey:    signingKey,
		encryptionKey: encryptionKey,
		deviceID:      deviceID,
		deviceName:    deviceName,
		keychainMode:  keychainMode,
	}
}

func NewDeviceWithKeysOnly(signingKey, encryptionKey GenericKey, keychainMode KeychainMode) *DeviceWithKeys {
	return &DeviceWithKeys{
		signingKey:    signingKey,
		encryptionKey: encryptionKey,
		keychainMode:  keychainMode,
	}
}

func (d DeviceWithKeys) EncryptionKey() GenericKey {
	return d.encryptionKey
}

func (d DeviceWithKeys) SigningKey() GenericKey {
	return d.signingKey
}

func (d DeviceWithKeys) DeviceID() keybase1.DeviceID {
	return d.deviceID
}

func (d DeviceWithKeys) DeviceName() string {
	return d.deviceName
}

func (d DeviceWithKeys) DeviceCtime() keybase1.Time {
	return d.deviceCtime
}

func (d *DeviceWithKeys) SetDeviceInfo(i keybase1.DeviceID, n string) {
	d.deviceID = i
	d.deviceName = n
}

func (d DeviceWithKeys) HasBothKeys() bool {
	return d.signingKey != nil && d.encryptionKey != nil
}

type SelfDestructingDeviceWithKeys struct {
	sync.Mutex
	deviceWithKeys    *DeviceWithKeys
	testPostCleanHook func()
}

func NewSelfDestructingDeviceWithKeys(m MetaContext, k *DeviceWithKeys, d time.Duration) *SelfDestructingDeviceWithKeys {
	ret := &SelfDestructingDeviceWithKeys{
		deviceWithKeys: k,
	}
	go ret.setFuse(m, d)
	return ret
}

func (s *SelfDestructingDeviceWithKeys) setFuse(m MetaContext, d time.Duration) {
	<-m.G().Clock().After(d)
	s.Lock()
	defer s.Unlock()
	s.deviceWithKeys = nil
	if s.testPostCleanHook != nil {
		s.testPostCleanHook()
	}
}

func (s *SelfDestructingDeviceWithKeys) SetTestPostCleanHook(f func()) {
	s.Lock()
	defer s.Unlock()
	s.testPostCleanHook = f
}

func (s *SelfDestructingDeviceWithKeys) DeviceWithKeys() *DeviceWithKeys {
	s.Lock()
	defer s.Unlock()
	if s.deviceWithKeys == nil {
		return nil
	}
	ret := *s.deviceWithKeys
	return &ret
}

// PopulateFromUser fills device metadata from an already-loaded and verified
// user sigchain.
func (d *DeviceWithKeys) PopulateFromUser(u *User) error {
	if u == nil || d.signingKey == nil {
		return NotFoundError{Msg: "KID not found"}
	}

	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		return NotFoundError{Msg: "KID not found"}
	}

	device, err := ckf.GetDeviceForKID(d.signingKey.GetKID())
	if err != nil || device == nil || !device.IsActive() || device.Description == nil {
		return NotFoundError{Msg: "KID not found"}
	}

	d.deviceID = device.ID
	d.deviceName = *device.Description
	d.deviceCtime = device.CTime
	return nil
}

func (d *DeviceWithKeys) ToProvisioningKeyActiveDevice(m MetaContext, uv keybase1.UserVersion) *ActiveDevice {
	return NewProvisioningKeyActiveDevice(m, uv, d)
}

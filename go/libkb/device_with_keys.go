package libkb

import (
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type DeviceWithKeys struct {
	signingKey    GenericKey
	encryptionKey GenericKey
	deviceID      keybase1.DeviceID
	deviceName    string
	deviceCtime   keybase1.Time
}

func NewDeviceWithKeys(signingKey, encryptionKey GenericKey, deviceID keybase1.DeviceID, deviceName string) *DeviceWithKeys {
	return &DeviceWithKeys{
		signingKey:    signingKey,
		encryptionKey: encryptionKey,
		deviceID:      deviceID,
		deviceName:    deviceName,
	}
}
func NewDeviceWithKeysOnly(signingKey, encryptionKey GenericKey) *DeviceWithKeys {
	return &DeviceWithKeys{
		signingKey:    signingKey,
		encryptionKey: encryptionKey,
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

type ownerDeviceReply struct {
	Status      AppStatus         `json:"status"`
	UID         keybase1.UID      `json:"uid"`
	DeviceID    keybase1.DeviceID `json:"device_id"`
	DeviceName  string            `json:"device_name"`
	DeviceCtime keybase1.Time     `json:"device_ctime"`
}

func (o *ownerDeviceReply) GetAppStatus() *AppStatus {
	return &o.Status
}

func (d *DeviceWithKeys) Populate(m MetaContext) (uid keybase1.UID, err error) {
	arg := APIArg{
		Endpoint:    "key/owner/device",
		SessionType: APISessionTypeNONE,
		Args:        HTTPArgs{"kid": S{Val: d.signingKey.GetKID().String()}},
		NetContext:  m.Ctx(),
	}
	var res ownerDeviceReply
	if err = m.G().API.GetDecode(arg, &res); err != nil {
		return uid, err
	}
	d.deviceID = res.DeviceID
	d.deviceName = res.DeviceName
	d.deviceCtime = res.DeviceCtime
	return res.UID, nil
}

func (d *DeviceWithKeys) ToProvisioningKeyActiveDevice(m MetaContext, uv keybase1.UserVersion) *ActiveDevice {
	return NewProvisioningKeyActiveDevice(m, uv, d)
}

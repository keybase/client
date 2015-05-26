// A module for syncing secrets with the server, such as SKB PGP keys,
// and server-halves of our various secret keys.
package libkb

import (
	"encoding/hex"
	"fmt"
	"sync"

	keybase1 "github.com/keybase/client/protocol/go"
)

type ServerPrivateKey struct {
	Kid     string `json:"kid"`
	KeyType int    `json:"key_type"`
	Bundle  string `json:"bundle"`
	Mtime   int    `json:"mtime"`
	Ctime   int    `json:"ctime"`
	KeyBits int    `json:"key_bits"`
	KeyAlgo int    `json:"key_algo"`
}

type ServerPrivateKeyMap map[string]ServerPrivateKey

type DeviceKey struct {
	Type          string `json:"type"`
	CTime         int64  `json:"ctime"`
	MTime         int64  `json:"mtime"`
	Description   string `json:"description"`
	Status        int    `json:"status"`
	LksServerHalf string `json:"lks_server_half"`
}

type DeviceKeyMap map[string]DeviceKey

type ServerPrivateKeys struct {
	Status      ApiStatus           `json:"status"`
	Version     int                 `json:"version"`
	Mtime       *int                `json:"mtime"`
	PrivateKeys ServerPrivateKeyMap `json:"private_keys"`
	Devices     DeviceKeyMap        `json:"devices"`
}

type SecretSyncer struct {
	sync.Mutex
	Contextified
	Uid   keybase1.UID
	dirty bool
	keys  *ServerPrivateKeys
}

func NewSecretSyncer(g *GlobalContext) *SecretSyncer {
	return &SecretSyncer{
		Contextified: NewContextified(g),
	}
}

func (ss *SecretSyncer) Clear() error {
	err := ss.store()
	ss.Uid = ""
	ss.keys = nil

	return err
}

// SetUID sets the UID.
func (ss *SecretSyncer) SetUID(u keybase1.UID) {
	ss.setUID(u)
}

func (ss *SecretSyncer) setUID(u keybase1.UID) {
	ss.Uid = u
}

// lock required before calling this.
func (ss *SecretSyncer) getUID() keybase1.UID {
	return ss.Uid
}

// Syncer locks before calling this.
func (ss *SecretSyncer) loadFromStorage() (err error) {
	var tmp ServerPrivateKeys
	var found bool
	found, err = ss.G().LocalDb.GetInto(&tmp, ss.dbKey())
	ss.G().Log.Debug("| loadFromStorage -> found=%v, err=%s", found, ErrToOk(err))
	if found {
		ss.G().Log.Debug("| Loaded version %d", tmp.Version)
	} else if err == nil {
		ss.G().Log.Debug("| Loaded empty record set")
	}
	if err == nil {
		ss.keys = &tmp
	}
	return
}

// Syncer locks before calling this.
func (ss *SecretSyncer) syncFromServer(sr SessionReader) (err error) {
	hargs := HttpArgs{}

	if ss.keys != nil {
		hargs.Add("version", I{ss.keys.Version})
	}
	var res *ApiRes
	res, err = ss.G().API.Get(ApiArg{
		Endpoint:    "key/fetch_private",
		Args:        hargs,
		NeedSession: true,
		SessionR:    sr,
	})
	ss.G().Log.Debug("| syncFromServer -> %s", ErrToOk(err))
	if err != nil {
		return
	}

	var obj ServerPrivateKeys
	if err = res.Body.UnmarshalAgain(&obj); err != nil {
		return
	}

	if ss.keys == nil || obj.Version > ss.keys.Version {
		ss.G().Log.Debug("| upgrade to version -> %d", obj.Version)
		ss.keys = &obj
		ss.dirty = true
	}

	return
}

// lock required before calling this.
func (ss *SecretSyncer) dbKey() DbKey {
	return DbKeyUID(DB_USER_SECRET_KEYS, ss.Uid)
}

// Syncer locks before calling this.
func (ss *SecretSyncer) store() (err error) {
	if !ss.dirty {
		return
	}
	if err = ss.G().LocalDb.PutObj(ss.dbKey(), nil, ss.keys); err != nil {
		return
	}
	ss.dirty = false
	return
}

// FindActiveKey examines the synced keys, looking for one that's currently active.
// Returns ret=nil if none was found.
func (ss *SecretSyncer) FindActiveKey(ckf *ComputedKeyFamily) (ret *SKB, err error) {
	for _, key := range ss.keys.PrivateKeys {
		if ret, _ = key.FindActiveKey(ckf); ret != nil {
			return
		}
	}
	return
}

func (ss *SecretSyncer) FindPrivateKey(kid string) (ServerPrivateKey, bool) {
	k, ok := ss.keys.PrivateKeys[kid]
	return k, ok
}

func (k *ServerPrivateKey) FindActiveKey(ckf *ComputedKeyFamily) (ret *SKB, err error) {
	var kid KID
	var packet *KeybasePacket

	if kid, err = ImportKID(k.Kid); err != nil {
		return
	}
	if ckf.GetKeyRole(kid) != DLG_SIBKEY {
		return
	}
	if packet, err = DecodeArmoredPacket(k.Bundle); err != nil && packet == nil {
		return
	}
	return packet.ToSKB()
}

func (ss *SecretSyncer) FindDevice(id *DeviceID) (DeviceKey, error) {
	if ss.keys == nil {
		return DeviceKey{}, fmt.Errorf("No device found for ID = %s", id)
	}
	dev, ok := ss.keys.Devices[id.String()]
	if !ok {
		return DeviceKey{}, fmt.Errorf("No device found for ID = %s", id)
	}
	return dev, nil
}

func (ss *SecretSyncer) HasDevices() bool {
	if ss.keys == nil {
		return false
	}
	return len(ss.keys.Devices) > 0
}

func (ss *SecretSyncer) Devices() (DeviceKeyMap, error) {
	if ss.keys == nil {
		return nil, fmt.Errorf("no keys")
	}
	return ss.keys.Devices, nil
}

func (ss *SecretSyncer) HasActiveDevice() bool {
	if ss.keys == nil {
		return false
	}
	for _, v := range ss.keys.Devices {
		if v.Status == DEVICE_STATUS_ACTIVE && v.Type != DEVICE_TYPE_WEB {
			return true
		}
	}
	return false
}

func (ss *SecretSyncer) ActiveDevices() (DeviceKeyMap, error) {
	if ss.keys == nil {
		return nil, fmt.Errorf("no keys")
	}
	res := make(DeviceKeyMap)
	for k, v := range ss.keys.Devices {
		if v.Status != DEVICE_STATUS_ACTIVE {
			continue
		}
		res[k] = v
	}
	return res, nil
}

// FindDetKeySrvHalf locates the detkey matching kt and returns
// the bundle, which is the server half of the detkey.
func (ss *SecretSyncer) FindDetKeySrvHalf(kt KeyType) ([]byte, error) {
	if kt != KEY_TYPE_KB_NACL_EDDSA_SERVER_HALF && kt != KEY_TYPE_KB_NACL_DH_SERVER_HALF {
		return nil, fmt.Errorf("invalid key type")
	}
	if ss.keys == nil {
		return nil, fmt.Errorf("no keys")
	}
	for _, key := range ss.keys.PrivateKeys {
		if KeyType(key.KeyType) != kt {
			continue
		}
		return hex.DecodeString(key.Bundle)
	}
	return nil, NotFoundError{msg: "detkey not found"}
}

func (ss *SecretSyncer) DumpPrivateKeys() {
	for s, key := range ss.keys.PrivateKeys {
		ss.G().Log.Info("Private key: %s", s)
		ss.G().Log.Info("  -- kid: %s, keytype: %d, bits: %d, algo: %d", key.Kid, key.KeyType, key.KeyBits, key.KeyAlgo)
	}
}

func (k ServerPrivateKey) ToSKB() (*SKB, error) {
	if k.KeyType != KEY_TYPE_P3SKB_PRIVATE {
		return nil, fmt.Errorf("invalid key type for skb conversion: %d", k.KeyType)
	}
	p, err := DecodeArmoredPacket(k.Bundle)
	if err != nil {
		return nil, err
	}
	skb, ok := p.Body.(*SKB)
	if !ok {
		return nil, fmt.Errorf("invalid packet type: %T", p.Body)
	}
	return skb, nil
}

func (ss *SecretSyncer) needsLogin() bool { return true }

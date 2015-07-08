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

type DeviceKeyMap map[keybase1.DeviceID]DeviceKey

type ServerPrivateKeys struct {
	Status      APIStatus           `json:"status"`
	Version     int                 `json:"version"`
	Mtime       *int                `json:"mtime"`
	PrivateKeys ServerPrivateKeyMap `json:"private_keys"`
	Devices     DeviceKeyMap        `json:"devices"`
}

type SecretSyncer struct {
	sync.Mutex
	Contextified
	dirty bool
	keys  *ServerPrivateKeys
}

func NewSecretSyncer(g *GlobalContext) *SecretSyncer {
	return &SecretSyncer{
		Contextified: NewContextified(g),
	}
}

func (ss *SecretSyncer) Clear() error {
	ss.keys = nil

	return nil
}

func (ss *SecretSyncer) loadFromStorage(uid keybase1.UID) (err error) {
	var tmp ServerPrivateKeys
	var found bool
	found, err = ss.G().LocalDb.GetInto(&tmp, ss.dbKey(uid))
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

func (ss *SecretSyncer) syncFromServer(uid keybase1.UID, sr SessionReader) (err error) {
	hargs := HTTPArgs{}

	if ss.keys != nil {
		hargs.Add("version", I{ss.keys.Version})
	}
	var res *APIRes
	res, err = ss.G().API.Get(APIArg{
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

func (ss *SecretSyncer) dbKey(uid keybase1.UID) DbKey {
	return DbKeyUID(DBUserSecretKeys, uid)
}

func (ss *SecretSyncer) store(uid keybase1.UID) (err error) {
	if !ss.dirty {
		return
	}
	if err = ss.G().LocalDb.PutObj(ss.dbKey(uid), nil, ss.keys); err != nil {
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
	if ckf.GetKeyRole(kid) != DLGSibkey {
		return
	}
	if packet, err = DecodeArmoredPacket(k.Bundle); err != nil && packet == nil {
		return
	}
	return packet.ToSKB()
}

func (ss *SecretSyncer) FindDevice(id keybase1.DeviceID) (DeviceKey, error) {
	if ss.keys == nil {
		return DeviceKey{}, fmt.Errorf("No device found for ID = %s", id)
	}
	dev, ok := ss.keys.Devices[id]
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
		if v.Status == DeviceStatusActive && v.Type != DeviceTypeWeb {
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
		if v.Status != DeviceStatusActive {
			continue
		}
		res[k] = v
	}
	return res, nil
}

// FindDetKeySrvHalf locates the detkey matching kt and returns
// the bundle, which is the server half of the detkey.
func (ss *SecretSyncer) FindDetKeySrvHalf(kt KeyType) ([]byte, error) {
	if kt != KeyTypeKbNaclEddsaServerHalf && kt != KeyTypeKbNaclDHServerHalf {
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
	if k.KeyType != KeyTypeP3skbPrivate {
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

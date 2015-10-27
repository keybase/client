// A module for syncing secrets with the server, such as SKB PGP keys,
// and server-halves of our various secret keys.
package libkb

import (
	"fmt"
	"strings"
	"sync"

	keybase1 "github.com/keybase/client/go/protocol"
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
	Type          string               `json:"type"`
	CTime         int64                `json:"ctime"`
	MTime         int64                `json:"mtime"`
	Description   string               `json:"name"`
	Status        int                  `json:"status"`
	LksServerHalf string               `json:"lks_server_half"`
	PPGen         PassphraseGeneration `json:"passphrase_generation"`
}

func (d DeviceKey) Display() string {
	if d.Type == DeviceTypePaper {
		// XXX not sure if we need to support our existing paper keys, but without this
		// someone is surely going to complain:
		if strings.HasPrefix(d.Description, "Paper Key") {
			return d.Description
		}
		return fmt.Sprintf("Paper Key (%s...)", d.Description)
	}
	return d.Description
}

type DeviceKeyMap map[keybase1.DeviceID]DeviceKey

type ServerPrivateKeys struct {
	Status      APIStatus           `json:"status"`
	Version     int                 `json:"version"`
	Mtime       *int                `json:"mtime"`
	PrivateKeys ServerPrivateKeyMap `json:"private_keys"` // note these are only PGP keys
	Devices     DeviceKeyMap        `json:"devices"`
}

type SecretSyncer struct {
	sync.Mutex
	Contextified
	dirty bool
	keys  *ServerPrivateKeys
}

type DeviceTypeSet map[string]bool

var DefaultDeviceTypes = DeviceTypeSet{
	DeviceTypeDesktop: true,
	DeviceTypeMobile:  true,
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
	if err != nil {
		return err
	}
	if !found {
		ss.G().Log.Debug("| Loaded empty record set")
		return nil
	}

	// only set ss.keys to something if found.
	//
	// This is part of keybase-issues#1783:  an (old) user with a synced
	// private key fell back to gpg instead of using a synced key.
	//

	ss.G().Log.Debug("| Loaded version %d", tmp.Version)
	ss.keys = &tmp

	return nil
}

func (ss *SecretSyncer) syncFromServer(uid keybase1.UID, sr SessionReader) (err error) {
	hargs := HTTPArgs{}

	if ss.keys != nil {
		ss.G().Log.Debug("| adding version %d to fetch_private call", ss.keys.Version)
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
	} else {
		ss.G().Log.Debug("| not changing synced keys: synced version %d not newer than existing version %d", obj.Version, ss.keys.Version)
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
	if ss.keys == nil {
		return nil, nil
	}
	for _, key := range ss.keys.PrivateKeys {
		if ret, _ = key.FindActiveKey(ckf); ret != nil {
			return
		}
	}
	return
}

// AllActiveKeys returns all the active synced PGP keys.
func (ss *SecretSyncer) AllActiveKeys(ckf *ComputedKeyFamily) []*SKB {
	var res []*SKB
	for _, key := range ss.keys.PrivateKeys {
		if ret, _ := key.FindActiveKey(ckf); ret != nil {
			res = append(res, ret)
		}
	}
	return res
}

func (ss *SecretSyncer) FindPrivateKey(kid string) (ServerPrivateKey, bool) {
	k, ok := ss.keys.PrivateKeys[kid]
	return k, ok
}

func (k *ServerPrivateKey) FindActiveKey(ckf *ComputedKeyFamily) (ret *SKB, err error) {
	kid := keybase1.KIDFromString(k.Kid)
	if ckf.GetKeyRole(kid) != DLGSibkey {
		return
	}
	var packet *KeybasePacket
	if packet, err = DecodeArmoredPacket(k.Bundle); err != nil && packet == nil {
		return
	}
	return packet.ToSKB()
}

func (ss *SecretSyncer) FindDevice(id keybase1.DeviceID) (DeviceKey, error) {
	if ss.keys == nil {
		return DeviceKey{}, fmt.Errorf("SecretSyncer: no device found for ID = %s", id)
	}
	dev, ok := ss.keys.Devices[id]
	if !ok {
		return DeviceKey{}, fmt.Errorf("SecretSyncer: no device found for ID = %s", id)
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

func (ss *SecretSyncer) dumpDevices() {
	ss.G().Log.Warning("dumpDevices:")
	if ss.keys == nil {
		ss.G().Log.Warning("dumpDevices -- ss.keys == nil")
		return
	}
	for devid, dev := range ss.keys.Devices {
		ss.G().Log.Warning("%s -> desc: %q, type: %q, ppgen: %d", devid, dev.Description, dev.Type, dev.PPGen)
	}
}

// IsDeviceNameTaken returns true if a desktop or mobile device is
// using a name already.
func (ss *SecretSyncer) IsDeviceNameTaken(name string, includeTypesSet DeviceTypeSet) bool {
	devs, err := ss.ActiveDevices(includeTypesSet)
	if err != nil {
		return false
	}
	for _, v := range devs {
		if NameCmp(v.Description, name) {
			return true
		}
	}
	return false
}

// HasActiveDevice returns true if there is an active desktop or
// mobile device available.
func (ss *SecretSyncer) HasActiveDevice(includeTypesSet DeviceTypeSet) (bool, error) {
	devs, err := ss.ActiveDevices(includeTypesSet)
	if err != nil {
		return false, err
	}
	return len(devs) > 0, nil
}

// ActiveDevices returns all the active desktop and mobile devices.
func (ss *SecretSyncer) ActiveDevices(includeTypesSet DeviceTypeSet) (DeviceKeyMap, error) {
	if ss.keys == nil {
		return nil, fmt.Errorf("no keys")
	}

	if includeTypesSet == nil {
		return nil, fmt.Errorf("need valid includeTypesSet")
	}

	res := make(DeviceKeyMap)
	for k, v := range ss.keys.Devices {
		if v.Status != DeviceStatusActive {
			continue
		}

		if includeTypesSet[v.Type] {
			res[k] = v
		}
	}
	return res, nil
}

func (ss *SecretSyncer) DumpPrivateKeys() {
	for s, key := range ss.keys.PrivateKeys {
		ss.G().Log.Info("Private key: %s", s)
		ss.G().Log.Info("  -- kid: %s, keytype: %d, bits: %d, algo: %d", key.Kid, key.KeyType, key.KeyBits, key.KeyAlgo)
	}
}

func (k ServerPrivateKey) ToSKB(gc *GlobalContext) (*SKB, error) {
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

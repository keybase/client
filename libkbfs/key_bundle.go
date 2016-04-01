package libkbfs

import (
	"reflect"

	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-codec/codec"
)

// All section references below are to https://keybase.io/blog/kbfs-crypto
// (version 1.3).

// TODO once TLFKeyBundle is removed, ensure that methods take
// value receivers unless they mutate the receiver.

// TLFCryptKeyServerHalfID is the identifier type for a server-side key half.
type TLFCryptKeyServerHalfID struct {
	ID HMAC // Exported for serialization.
}

// DeepCopy returns a complete copy of a TLFCryptKeyServerHalfID.
func (id TLFCryptKeyServerHalfID) DeepCopy() TLFCryptKeyServerHalfID {
	return id
}

// String implements the Stringer interface for TLFCryptKeyServerHalfID.
func (id TLFCryptKeyServerHalfID) String() string {
	return id.ID.String()
}

// TLFCryptKeyInfo is a per-device key half entry in the
// TLFWriterKeyBundle/TLFReaderKeyBundle.
type TLFCryptKeyInfo struct {
	ClientHalf   EncryptedTLFCryptKeyClientHalf
	ServerHalfID TLFCryptKeyServerHalfID
	EPubKeyIndex int `codec:"i,omitempty"`

	codec.UnknownFieldSet
}

type copyFields int

const (
	allFields copyFields = iota
	knownFieldsOnly
)

// deepCopyHelper returns a deep copy of a TLFCryptKeyInfo, with or
// without unknown fields.
func (info TLFCryptKeyInfo) deepCopyHelper(f copyFields) TLFCryptKeyInfo {
	infoCopy := TLFCryptKeyInfo{
		ClientHalf:   info.ClientHalf.DeepCopy(),
		ServerHalfID: info.ServerHalfID.DeepCopy(),
		EPubKeyIndex: info.EPubKeyIndex,
	}
	if f == allFields {
		infoCopy.UnknownFieldSet = info.UnknownFieldSet.DeepCopy()
	}
	return infoCopy
}

// DeepCopy returns a complete copy of a TLFCryptKeyInfo.
func (info TLFCryptKeyInfo) DeepCopy() TLFCryptKeyInfo {
	return info.deepCopyHelper(allFields)
}

// DeviceKeyInfoMap is a map from a user devices (identified by the
// KID of the corresponding device CryptPublicKey) to the
// TLF's symmetric secret key information.
type DeviceKeyInfoMap map[keybase1.KID]TLFCryptKeyInfo

// deepCopyHelper returns a deep copy of a DeviceKeyInfoMap, with or
// without unknown fields.
func (kim DeviceKeyInfoMap) deepCopyHelper(f copyFields) DeviceKeyInfoMap {
	kimCopy := DeviceKeyInfoMap{}
	for k, b := range kim {
		kimCopy[k] = b.deepCopyHelper(f)
	}
	return kimCopy
}

// DeepCopy returns a complete copy of a DeviceKeyInfoMap
func (kim DeviceKeyInfoMap) DeepCopy() DeviceKeyInfoMap {
	return kim.deepCopyHelper(allFields)
}

func (kim DeviceKeyInfoMap) fillInDeviceInfo(crypto Crypto,
	uid keybase1.UID, tlfCryptKey TLFCryptKey,
	ePrivKey TLFEphemeralPrivateKey, ePubIndex int,
	publicKeys []CryptPublicKey) (
	serverMap map[keybase1.KID]TLFCryptKeyServerHalf, err error) {
	serverMap = make(map[keybase1.KID]TLFCryptKeyServerHalf)
	// for each device:
	//    * create a new random server half
	//    * mask it with the key to get the client half
	//    * encrypt the client half
	//
	// TODO: parallelize
	for _, k := range publicKeys {
		// Skip existing entries, only fill in new ones
		if _, ok := kim[k.kid]; ok {
			continue
		}

		var serverHalf TLFCryptKeyServerHalf
		serverHalf, err = crypto.MakeRandomTLFCryptKeyServerHalf()
		if err != nil {
			return nil, err
		}

		var clientHalf TLFCryptKeyClientHalf
		clientHalf, err = crypto.MaskTLFCryptKey(serverHalf, tlfCryptKey)
		if err != nil {
			return nil, err
		}

		var encryptedClientHalf EncryptedTLFCryptKeyClientHalf
		encryptedClientHalf, err =
			crypto.EncryptTLFCryptKeyClientHalf(ePrivKey, k, clientHalf)
		if err != nil {
			return nil, err
		}

		var serverHalfID TLFCryptKeyServerHalfID
		serverHalfID, err =
			crypto.GetTLFCryptKeyServerHalfID(uid, k.kid, serverHalf)
		if err != nil {
			return nil, err
		}

		kim[k.kid] = TLFCryptKeyInfo{
			ClientHalf:   encryptedClientHalf,
			ServerHalfID: serverHalfID,
			EPubKeyIndex: ePubIndex,
		}
		serverMap[k.kid] = serverHalf
	}

	return serverMap, nil
}

// GetKIDs returns the KIDs for the given bundle.
func (kim DeviceKeyInfoMap) GetKIDs() []keybase1.KID {
	var keys []keybase1.KID
	for k := range kim {
		keys = append(keys, k)
	}
	return keys
}

// UserDeviceKeyInfoMap maps a user's keybase UID to their DeviceKeyInfoMap
type UserDeviceKeyInfoMap map[keybase1.UID]DeviceKeyInfoMap

// deepCopyHelper returns a deep copy of a UserDeviceKeyInfoMap, with
// or without unknown fields.
func (ukim UserDeviceKeyInfoMap) deepCopyHelper(f copyFields) UserDeviceKeyInfoMap {
	ukimCopy := make(UserDeviceKeyInfoMap, len(ukim))
	for u, m := range ukim {
		ukimCopy[u] = m.deepCopyHelper(f)
	}
	return ukimCopy
}

// DeepCopy returns a complete copy of this UserDeviceKeyInfoMap
func (ukim UserDeviceKeyInfoMap) DeepCopy() UserDeviceKeyInfoMap {
	return ukim.deepCopyHelper(allFields)
}

// TLFWriterKeyBundle is a bundle of all the writer keys for a top-level
// folder.
type TLFWriterKeyBundle struct {
	// Maps from each writer to their crypt key bundle.
	// TODO rename once we're rid of TLFKeyBundle
	WKeys UserDeviceKeyInfoMap

	// M_f as described in 4.1.1 of https://keybase.io/blog/kbfs-crypto.
	TLFPublicKey TLFPublicKey `codec:"pubKey"`

	// M_e as described in 4.1.1 of https://keybase.io/blog/kbfs-crypto.
	// Because devices can be added into the key generation after it
	// is initially created (so those devices can get access to
	// existing data), we track multiple ephemeral public keys; the
	// one used by a particular device is specified by EPubKeyIndex in
	// its TLFCryptoKeyInfo struct.
	TLFEphemeralPublicKeys TLFEphemeralPublicKeys `codec:"ePubKey"`

	codec.UnknownFieldSet
}

// DeepEqual returns true if two TLFWriterKeyBundles are equal.
func (tkb TLFWriterKeyBundle) DeepEqual(rhs TLFWriterKeyBundle) bool {
	return reflect.DeepEqual(tkb, rhs)
}

// deepCopyHelper returns a deep copy of a TLFWriterKeyBundle, with or
// without unknown fields.
func (tkb *TLFWriterKeyBundle) deepCopyHelper(f copyFields) *TLFWriterKeyBundle {
	tkbCopy := &TLFWriterKeyBundle{
		WKeys:                  tkb.WKeys.deepCopyHelper(f),
		TLFPublicKey:           tkb.TLFPublicKey,
		TLFEphemeralPublicKeys: tkb.TLFEphemeralPublicKeys.DeepCopy(),
	}
	if f == allFields {
		tkbCopy.UnknownFieldSet = tkb.UnknownFieldSet.DeepCopy()
	}
	return tkbCopy
}

// DeepCopy returns a complete copy of this TLFWriterKeyBundle.
func (tkb *TLFWriterKeyBundle) DeepCopy() *TLFWriterKeyBundle {
	return tkb.deepCopyHelper(allFields)
}

// IsWriter returns true if the given user device is in the writer set.
func (tkb TLFWriterKeyBundle) IsWriter(user keybase1.UID, deviceKID keybase1.KID) bool {
	_, ok := tkb.WKeys[user][deviceKID]
	return ok
}

// TLFWriterKeyGenerations stores a slice of TLFWriterKeyBundle,
// where the last element is the current generation.
type TLFWriterKeyGenerations []*TLFWriterKeyBundle

// DeepEqual returns true if two sets of key generations are equal.
func (tkg TLFWriterKeyGenerations) DeepEqual(rhs TLFWriterKeyGenerations) bool {
	if len(tkg) != len(rhs) {
		return false
	}
	for i, k := range tkg {
		if !rhs[i].DeepEqual(*k) {
			return false
		}
	}
	return true
}

// deepCopyHelper returns a deep copy of a TLFWriterKeyGenerations, with or
// without unknown fields.
func (tkg TLFWriterKeyGenerations) deepCopyHelper(f copyFields) TLFWriterKeyGenerations {
	keys := make(TLFWriterKeyGenerations, len(tkg))
	for i, k := range tkg {
		keys[i] = k.deepCopyHelper(f)
	}
	return keys
}

// DeepCopy returns a complete copy of this TLFKeyGenerations.
func (tkg TLFWriterKeyGenerations) DeepCopy() TLFWriterKeyGenerations {
	return tkg.deepCopyHelper(allFields)
}

// LatestKeyGeneration returns the current key generation for this TLF.
func (tkg TLFWriterKeyGenerations) LatestKeyGeneration() KeyGen {
	return KeyGen(len(tkg))
}

// IsWriter returns whether or not the user+device is an authorized writer
// for the latest generation.
func (tkg TLFWriterKeyGenerations) IsWriter(user keybase1.UID, deviceKID keybase1.KID) bool {
	keyGen := tkg.LatestKeyGeneration()
	if keyGen < 1 {
		return false
	}
	return tkg[keyGen-1].IsWriter(user, deviceKID)
}

// TLFReaderKeyBundle stores all the user keys with reader
// permissions on a TLF
type TLFReaderKeyBundle struct {
	// TODO rename once we're rid of TLFKeyBundle
	RKeys UserDeviceKeyInfoMap

	// M_e as described in 4.1.1 of https://keybase.io/blog/kbfs-crypto.
	// Because devices can be added into the key generation after it
	// is initially created (so those devices can get access to
	// existing data), we track multiple ephemeral public keys; the
	// one used by a particular device is specified by EPubKeyIndex in
	// its TLFCryptoKeyInfo struct.
	// This list is needed so a reader rekey doesn't modify the writer
	// metadata.
	TLFReaderEphemeralPublicKeys TLFEphemeralPublicKeys `codec:"readerEPubKey,omitempty"`

	codec.UnknownFieldSet
}

// DeepEqual returns true if two TLFReaderKeyBundles are equal.
func (trb TLFReaderKeyBundle) DeepEqual(rhs TLFReaderKeyBundle) bool {
	return reflect.DeepEqual(trb, rhs)
}

// deepCopyHelper returns a deep copy of a TLFReaderKeyBundle, with or
// without unknown fields.
func (trb *TLFReaderKeyBundle) deepCopyHelper(f copyFields) *TLFReaderKeyBundle {
	trbCopy := &TLFReaderKeyBundle{
		RKeys: trb.RKeys.deepCopyHelper(f),
		TLFReaderEphemeralPublicKeys: trb.TLFReaderEphemeralPublicKeys.DeepCopy(),
	}
	if f == allFields {
		trbCopy.UnknownFieldSet = trb.UnknownFieldSet.DeepCopy()
	}
	return trbCopy
}

// DeepCopy returns a complete copy of this TLFReaderKeyBundle.
func (trb *TLFReaderKeyBundle) DeepCopy() *TLFReaderKeyBundle {
	return trb.deepCopyHelper(allFields)
}

// IsReader returns true if the given user device is in the reader set.
func (trb TLFReaderKeyBundle) IsReader(user keybase1.UID, deviceKID keybase1.KID) bool {
	_, ok := trb.RKeys[user][deviceKID]
	return ok
}

// TLFReaderKeyGenerations stores a slice of TLFReaderKeyBundle,
// where the last element is the current generation.
type TLFReaderKeyGenerations []*TLFReaderKeyBundle

// DeepEqual returns true if two sets of key generations are equal.
func (tkg TLFReaderKeyGenerations) DeepEqual(rhs TLFReaderKeyGenerations) bool {
	if len(tkg) != len(rhs) {
		return false
	}
	for i, k := range tkg {
		if !rhs[i].DeepEqual(*k) {
			return false
		}
	}
	return true
}

// LatestKeyGeneration returns the current key generation for this TLF.
func (tkg TLFReaderKeyGenerations) LatestKeyGeneration() KeyGen {
	return KeyGen(len(tkg))
}

// deepCopyHelper returns a deep copy of a TLFReaderKeyGenerations, with or
// without unknown fields.
func (tkg TLFReaderKeyGenerations) deepCopyHelper(f copyFields) TLFReaderKeyGenerations {
	keys := make(TLFReaderKeyGenerations, len(tkg))
	for i, k := range tkg {
		keys[i] = k.deepCopyHelper(f)
	}
	return keys
}

// DeepCopy returns a complete copy of this TLFKeyGenerations.
func (tkg TLFReaderKeyGenerations) DeepCopy() TLFReaderKeyGenerations {
	return tkg.deepCopyHelper(allFields)
}

// IsReader returns whether or not the user+device is an authorized reader
// for the latest generation.
func (tkg TLFReaderKeyGenerations) IsReader(user keybase1.UID, deviceKID keybase1.KID) bool {
	keyGen := tkg.LatestKeyGeneration()
	if keyGen < 1 {
		return false
	}
	return tkg[keyGen-1].IsReader(user, deviceKID)
}

// TLFKeyBundle is a bundle of all the keys for a top-level folder.
// TODO get rid of this once we're fully dependent on reader and writer bundles separately
type TLFKeyBundle struct {
	*TLFWriterKeyBundle
	*TLFReaderKeyBundle
}

// NewTLFKeyBundle creates a new empty TLFKeyBundle
func NewTLFKeyBundle() *TLFKeyBundle {
	return &TLFKeyBundle{
		&TLFWriterKeyBundle{
			WKeys: make(UserDeviceKeyInfoMap, 0),
		},
		&TLFReaderKeyBundle{
			RKeys: make(UserDeviceKeyInfoMap, 0),
		},
	}
}

// DeepCopy returns a complete copy of this TLFKeyBundle.
func (tkb TLFKeyBundle) DeepCopy() TLFKeyBundle {
	return TLFKeyBundle{
		TLFWriterKeyBundle: tkb.TLFWriterKeyBundle.DeepCopy(),
		TLFReaderKeyBundle: tkb.TLFReaderKeyBundle.DeepCopy(),
	}
}

type serverKeyMap map[keybase1.UID]map[keybase1.KID]TLFCryptKeyServerHalf

func fillInDevicesAndServerMap(crypto Crypto, newIndex int,
	cryptKeys map[keybase1.UID][]CryptPublicKey,
	keyInfoMap UserDeviceKeyInfoMap,
	ePubKey TLFEphemeralPublicKey, ePrivKey TLFEphemeralPrivateKey,
	tlfCryptKey TLFCryptKey, newServerKeys serverKeyMap) error {
	for u, keys := range cryptKeys {
		if _, ok := keyInfoMap[u]; !ok {
			keyInfoMap[u] = DeviceKeyInfoMap{}
		}

		serverMap, err := keyInfoMap[u].fillInDeviceInfo(
			crypto, u, tlfCryptKey, ePrivKey, newIndex, keys)
		if err != nil {
			return err
		}
		if len(serverMap) > 0 {
			newServerKeys[u] = serverMap
		}
	}
	return nil
}

// fillInDevices ensures that every device for every writer and reader
// in the provided lists has complete TLF crypt key info, and uses the
// new ephemeral key pair to generate the info if it doesn't yet
// exist.
func (tkb *TLFKeyBundle) fillInDevices(crypto Crypto,
	wKeys map[keybase1.UID][]CryptPublicKey,
	rKeys map[keybase1.UID][]CryptPublicKey, ePubKey TLFEphemeralPublicKey,
	ePrivKey TLFEphemeralPrivateKey, tlfCryptKey TLFCryptKey) (
	serverKeyMap, error) {
	var newIndex int
	if len(wKeys) == 0 {
		// This is VERY ugly, but we need it in order to avoid having to
		// version the metadata. The index will be strictly negative for reader
		// ephemeral public keys
		tkb.TLFReaderEphemeralPublicKeys =
			append(tkb.TLFReaderEphemeralPublicKeys, ePubKey)
		newIndex = -len(tkb.TLFReaderEphemeralPublicKeys)
	} else {
		tkb.TLFEphemeralPublicKeys =
			append(tkb.TLFEphemeralPublicKeys, ePubKey)
		newIndex = len(tkb.TLFEphemeralPublicKeys) - 1
	}

	// now fill in the secret keys as needed
	newServerKeys := serverKeyMap{}
	err := fillInDevicesAndServerMap(crypto, newIndex, wKeys, tkb.WKeys,
		ePubKey, ePrivKey, tlfCryptKey, newServerKeys)
	if err != nil {
		return nil, err
	}
	err = fillInDevicesAndServerMap(crypto, newIndex, rKeys, tkb.RKeys,
		ePubKey, ePrivKey, tlfCryptKey, newServerKeys)
	if err != nil {
		return nil, err
	}
	return newServerKeys, nil
}

// GetTLFCryptKeyInfo returns the TLFCryptKeyInfo entry for the given user
// and device.
func (tkb TLFKeyBundle) GetTLFCryptKeyInfo(user keybase1.UID,
	currentCryptPublicKey CryptPublicKey) (TLFCryptKeyInfo, bool, error) {
	key := currentCryptPublicKey.kid
	if u, ok1 := tkb.WKeys[user]; ok1 {
		info, ok := u[key]
		return info, ok, nil
	} else if u, ok1 = tkb.RKeys[user]; ok1 {
		info, ok := u[key]
		return info, ok, nil
	}
	return TLFCryptKeyInfo{}, false, nil
}

// GetTLFEphemeralPublicKey returns the ephemeral public key used for
// the TLFCryptKeyInfo for the given user and device.
func (tkb TLFKeyBundle) GetTLFEphemeralPublicKey(user keybase1.UID,
	currentCryptPublicKey CryptPublicKey) (TLFEphemeralPublicKey, error) {
	key := currentCryptPublicKey.kid

	info, ok, err := tkb.GetTLFCryptKeyInfo(user, currentCryptPublicKey)
	if err != nil {
		return TLFEphemeralPublicKey{}, err
	}
	if !ok {
		return TLFEphemeralPublicKey{},
			TLFEphemeralPublicKeyNotFoundError{user, key}
	}

	if info.EPubKeyIndex < 0 {
		return tkb.TLFReaderEphemeralPublicKeys[-1-info.EPubKeyIndex], nil
	}
	return tkb.TLFEphemeralPublicKeys[info.EPubKeyIndex], nil
}

// GetTLFCryptPublicKeys returns the public crypt keys for the given user.
func (tkb TLFKeyBundle) GetTLFCryptPublicKeys(user keybase1.UID) ([]keybase1.KID, bool) {
	if u, ok1 := tkb.WKeys[user]; ok1 {
		return u.GetKIDs(), true
	} else if u, ok1 = tkb.RKeys[user]; ok1 {
		return u.GetKIDs(), true
	}
	return nil, false
}

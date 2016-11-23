// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfshash"
	"golang.org/x/net/context"
)

// All section references below are to https://keybase.io/blog/kbfs-crypto
// (version 1.3).

// TLFCryptKeyServerHalfID is the identifier type for a server-side key half.
type TLFCryptKeyServerHalfID struct {
	ID kbfshash.HMAC // Exported for serialization.
}

// String implements the Stringer interface for TLFCryptKeyServerHalfID.
func (id TLFCryptKeyServerHalfID) String() string {
	return id.ID.String()
}

// TLFCryptKeyInfo is a per-device key half entry in the
// TLFWriterKeyBundleV2/TLFReaderKeyBundleV2.
type TLFCryptKeyInfo struct {
	ClientHalf   EncryptedTLFCryptKeyClientHalf
	ServerHalfID TLFCryptKeyServerHalfID
	EPubKeyIndex int `codec:"i,omitempty"`

	codec.UnknownFieldSetHandler
}

type copyFields int

const (
	allFields copyFields = iota
	knownFieldsOnly
)

// DeviceKeyInfoMap is a map from a user devices (identified by the
// KID of the corresponding device CryptPublicKey) to the
// TLF's symmetric secret key information.
type DeviceKeyInfoMap map[keybase1.KID]TLFCryptKeyInfo

func (kim DeviceKeyInfoMap) fillInDeviceInfo(crypto Crypto,
	uid keybase1.UID, tlfCryptKey kbfscrypto.TLFCryptKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey, ePubIndex int,
	publicKeys []kbfscrypto.CryptPublicKey) (
	serverMap map[keybase1.KID]kbfscrypto.TLFCryptKeyServerHalf,
	err error) {
	serverMap = make(map[keybase1.KID]kbfscrypto.TLFCryptKeyServerHalf)
	// for each device:
	//    * create a new random server half
	//    * mask it with the key to get the client half
	//    * encrypt the client half
	//
	// TODO: parallelize
	for _, k := range publicKeys {
		// Skip existing entries, only fill in new ones
		if _, ok := kim[k.KID()]; ok {
			continue
		}

		var serverHalf kbfscrypto.TLFCryptKeyServerHalf
		serverHalf, err = crypto.MakeRandomTLFCryptKeyServerHalf()
		if err != nil {
			return nil, err
		}

		var clientHalf kbfscrypto.TLFCryptKeyClientHalf
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
			crypto.GetTLFCryptKeyServerHalfID(uid, k.KID(), serverHalf)
		if err != nil {
			return nil, err
		}

		kim[k.KID()] = TLFCryptKeyInfo{
			ClientHalf:   encryptedClientHalf,
			ServerHalfID: serverHalfID,
			EPubKeyIndex: ePubIndex,
		}
		serverMap[k.KID()] = serverHalf
	}

	return serverMap, nil
}

func (kim DeviceKeyInfoMap) deepCopy() DeviceKeyInfoMap {
	kimCopy := make(DeviceKeyInfoMap)
	for kid, info := range kim {
		kimCopy[kid] = info
	}
	return kimCopy
}

// UserDeviceKeyInfoMap maps a user's keybase UID to their DeviceKeyInfoMap
type UserDeviceKeyInfoMap map[keybase1.UID]DeviceKeyInfoMap

func (dkim UserDeviceKeyInfoMap) deepCopy() UserDeviceKeyInfoMap {
	dkimCopy := make(UserDeviceKeyInfoMap)
	for uid, kim := range dkim {
		dkimCopy[uid] = kim.deepCopy()
	}
	return dkimCopy
}

// TLFWriterKeyBundleV2 is a bundle of all the writer keys for a top-level
// folder.
type TLFWriterKeyBundleV2 struct {
	// Maps from each writer to their crypt key bundle.
	WKeys UserDeviceKeyInfoMap

	// M_f as described in 4.1.1 of https://keybase.io/blog/kbfs-crypto.
	TLFPublicKey kbfscrypto.TLFPublicKey `codec:"pubKey"`

	// M_e as described in 4.1.1 of https://keybase.io/blog/kbfs-crypto.
	// Because devices can be added into the key generation after it
	// is initially created (so those devices can get access to
	// existing data), we track multiple ephemeral public keys; the
	// one used by a particular device is specified by EPubKeyIndex in
	// its TLFCryptoKeyInfo struct.
	TLFEphemeralPublicKeys kbfscrypto.TLFEphemeralPublicKeys `codec:"ePubKey"`

	codec.UnknownFieldSetHandler
}

// IsWriter returns true if the given user device is in the writer set.
func (tkb TLFWriterKeyBundleV2) IsWriter(user keybase1.UID, deviceKID keybase1.KID) bool {
	_, ok := tkb.WKeys[user][deviceKID]
	return ok
}

// TLFWriterKeyGenerations stores a slice of TLFWriterKeyBundleV2,
// where the last element is the current generation.
type TLFWriterKeyGenerations []TLFWriterKeyBundleV2

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

// ToTLFWriterKeyBundleV3 converts a TLFWriterKeyGenerations to a TLFWriterKeyBundleV3.
func (tkg TLFWriterKeyGenerations) ToTLFWriterKeyBundleV3(
	ctx context.Context, crypto cryptoPure, keyManager KeyManager, kmd KeyMetadata) (
	*TLFWriterKeyBundleV3, error) {

	keyGen := tkg.LatestKeyGeneration()
	if keyGen < FirstValidKeyGen {
		return nil, errors.New("No key generations to convert")
	}

	wkbCopy := &TLFWriterKeyBundleV3{}

	// Copy the latest UserDeviceKeyInfoMap.
	wkb := tkg[keyGen-FirstValidKeyGen]
	wkbCopy.Keys = wkb.WKeys.deepCopy()

	// Copy all of the TLFEphemeralPublicKeys at this generation.
	wkbCopy.TLFEphemeralPublicKeys =
		make(kbfscrypto.TLFEphemeralPublicKeys, len(wkb.TLFEphemeralPublicKeys))
	copy(wkbCopy.TLFEphemeralPublicKeys[:], wkb.TLFEphemeralPublicKeys)

	// Copy the current TLFPublicKey.
	wkbCopy.TLFPublicKey = wkb.TLFPublicKey

	if keyGen > FirstValidKeyGen {
		// Fetch all of the TLFCryptKeys.
		keys, err := keyManager.GetTLFCryptKeyOfAllGenerations(ctx, kmd)
		if err != nil {
			return nil, err
		}
		// Sanity check.
		if len(keys) != int(keyGen) {
			return nil, fmt.Errorf("expected %d keys, found %d", keyGen, len(keys))
		}
		// Save the current key.
		currKey := keys[len(keys)-1]
		// Get rid of the most current generation as that's in the UserDeviceKeyInfoMap already.
		keys = keys[:len(keys)-1]
		// Encrypt the historic keys with the current key.
		wkbCopy.EncryptedHistoricTLFCryptKeys, err = crypto.EncryptTLFCryptKeys(keys, currKey)
		if err != nil {
			return nil, err
		}
	}

	return wkbCopy, nil
}

// TLFReaderKeyBundleV2 stores all the user keys with reader
// permissions on a TLF
type TLFReaderKeyBundleV2 struct {
	RKeys UserDeviceKeyInfoMap

	// M_e as described in 4.1.1 of https://keybase.io/blog/kbfs-crypto.
	// Because devices can be added into the key generation after it
	// is initially created (so those devices can get access to
	// existing data), we track multiple ephemeral public keys; the
	// one used by a particular device is specified by EPubKeyIndex in
	// its TLFCryptoKeyInfo struct.
	// This list is needed so a reader rekey doesn't modify the writer
	// metadata.
	TLFReaderEphemeralPublicKeys kbfscrypto.TLFEphemeralPublicKeys `codec:"readerEPubKey,omitempty"`

	codec.UnknownFieldSetHandler
}

// IsReader returns true if the given user device is in the reader set.
func (trb TLFReaderKeyBundleV2) IsReader(user keybase1.UID, deviceKID keybase1.KID) bool {
	_, ok := trb.RKeys[user][deviceKID]
	return ok
}

// TLFReaderKeyGenerations stores a slice of TLFReaderKeyBundleV2,
// where the last element is the current generation.
type TLFReaderKeyGenerations []TLFReaderKeyBundleV2

// LatestKeyGeneration returns the current key generation for this TLF.
func (tkg TLFReaderKeyGenerations) LatestKeyGeneration() KeyGen {
	return KeyGen(len(tkg))
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

// ToTLFReaderKeyBundleV3 converts a TLFReaderKeyGenerations to a TLFReaderkeyBundleV3.
func (tkg TLFReaderKeyGenerations) ToTLFReaderKeyBundleV3(wkb *TLFWriterKeyBundleV3) (
	*TLFReaderKeyBundleV3, error) {

	keyGen := tkg.LatestKeyGeneration()
	if keyGen < 1 {
		return nil, errors.New("No key generations to convert")
	}

	rkbCopy := &TLFReaderKeyBundleV3{
		TLFReaderKeyBundleV2: TLFReaderKeyBundleV2{
			RKeys: make(UserDeviceKeyInfoMap),
		},
	}

	// Copy the latest UserDeviceKeyInfoMap.
	rkb := tkg[keyGen-1]

	// Copy all of the TLFReaderEphemeralPublicKeys.
	for _, ePubKey := range rkb.TLFReaderEphemeralPublicKeys {
		rkbCopy.TLFReaderEphemeralPublicKeys =
			append(rkbCopy.TLFReaderEphemeralPublicKeys, ePubKey)
	}

	// Track a mapping of old writer ephemeral pubkey index to new
	// reader epehemeral pubkey index.
	pubKeyIndicesMap := make(map[int]int)

	// We need to copy these in a slightly annoying way to work around
	// the negative index hack. In V3 readers always have their ePubKey
	// in the TLFReaderEphemeralPublicKeys list. In V2 they only do if
	// the index is negative. Otherwise it's in the writer's list.
	for uid, dkim := range rkb.RKeys {
		dkimCopy := make(DeviceKeyInfoMap)
		for kid, info := range dkim {
			if info.EPubKeyIndex < 0 {
				// Convert to the real index in the reader list.
				newIndex := -1 - info.EPubKeyIndex
				info.EPubKeyIndex = newIndex
			} else {
				oldIndex := info.EPubKeyIndex
				if oldIndex >= len(wkb.TLFEphemeralPublicKeys) {
					err := fmt.Errorf("Invalid index %d (len: %d)",
						oldIndex, len(wkb.TLFEphemeralPublicKeys))
					return nil, err
				}
				// Map the old index in the writer list to a new index
				// at the end of the reader list.
				if newIndex, ok := pubKeyIndicesMap[oldIndex]; !ok {
					ePubKey := wkb.TLFEphemeralPublicKeys[oldIndex]
					rkbCopy.TLFReaderEphemeralPublicKeys =
						append(rkbCopy.TLFReaderEphemeralPublicKeys, ePubKey)
					newIndex = len(rkbCopy.TLFReaderEphemeralPublicKeys) - 1
					pubKeyIndicesMap[oldIndex] = newIndex
					info.EPubKeyIndex = newIndex
				} else {
					info.EPubKeyIndex = newIndex
				}
			}
			dkimCopy[kid] = info
		}
		rkbCopy.RKeys[uid] = dkimCopy
	}
	return rkbCopy, nil
}

type serverKeyMap map[keybase1.UID]map[keybase1.KID]kbfscrypto.TLFCryptKeyServerHalf

func fillInDevicesAndServerMap(crypto Crypto, newIndex int,
	cryptKeys map[keybase1.UID][]kbfscrypto.CryptPublicKey,
	keyInfoMap UserDeviceKeyInfoMap,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKey kbfscrypto.TLFCryptKey, newServerKeys serverKeyMap) error {
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
// MDv3 TODO: get rid of this as it's only used in tests right now.
func fillInDevices(crypto Crypto,
	wkb *TLFWriterKeyBundleV2, rkb *TLFReaderKeyBundleV2,
	wKeys map[keybase1.UID][]kbfscrypto.CryptPublicKey,
	rKeys map[keybase1.UID][]kbfscrypto.CryptPublicKey,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKey kbfscrypto.TLFCryptKey) (
	serverKeyMap, error) {
	var newIndex int
	if len(wKeys) == 0 {
		// This is VERY ugly, but we need it in order to avoid having to
		// version the metadata. The index will be strictly negative for reader
		// ephemeral public keys
		rkb.TLFReaderEphemeralPublicKeys =
			append(rkb.TLFReaderEphemeralPublicKeys, ePubKey)
		newIndex = -len(rkb.TLFReaderEphemeralPublicKeys)
	} else {
		wkb.TLFEphemeralPublicKeys =
			append(wkb.TLFEphemeralPublicKeys, ePubKey)
		newIndex = len(wkb.TLFEphemeralPublicKeys) - 1
	}

	// now fill in the secret keys as needed
	newServerKeys := serverKeyMap{}
	err := fillInDevicesAndServerMap(crypto, newIndex, wKeys, wkb.WKeys,
		ePubKey, ePrivKey, tlfCryptKey, newServerKeys)
	if err != nil {
		return nil, err
	}
	err = fillInDevicesAndServerMap(crypto, newIndex, rKeys, rkb.RKeys,
		ePubKey, ePrivKey, tlfCryptKey, newServerKeys)
	if err != nil {
		return nil, err
	}
	return newServerKeys, nil
}

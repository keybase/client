// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/pkg/errors"
)

// EPubKeyLocationV2 represents the location of a user's ephemeral
// public key. Note that for V2, a reader ePubKey can be in either the
// writers array (if rekeyed normally) or the readers array (if
// rekeyed by a reader), but a writer ePubKey can be in either array
// also; if a reader whose ePubKey is in the readers array is
// promoted, then the reader becomes a writer whose ePubKey is still
// in the readers array.
type EPubKeyLocationV2 int

const (
	// WriterEPubKeys means the ephemeral public key is in the
	// writers array.
	WriterEPubKeys EPubKeyLocationV2 = 1
	// ReaderEPubKeys means the ephemeral public key is in the
	// writers array.
	ReaderEPubKeys EPubKeyLocationV2 = 2
)

func (t EPubKeyLocationV2) String() string {
	switch t {
	case WriterEPubKeys:
		return "WriterEPubKeys"
	case ReaderEPubKeys:
		return "ReaderEPubKeys"
	default:
		return fmt.Sprintf("EPubKeyLocationV2(%d)", t)
	}
}

// GetEphemeralPublicKeyInfoV2 encapsulates all the ugly logic needed to
// deal with the "negative hack" from
// BareRootMetadataV2.UpdateKeyGeneration.
func GetEphemeralPublicKeyInfoV2(info TLFCryptKeyInfo,
	wkb TLFWriterKeyBundleV2, rkb TLFReaderKeyBundleV2) (
	keyLocation EPubKeyLocationV2, index int,
	ePubKey kbfscrypto.TLFEphemeralPublicKey, err error) {
	var publicKeys kbfscrypto.TLFEphemeralPublicKeys
	if info.EPubKeyIndex >= 0 {
		index = info.EPubKeyIndex
		publicKeys = wkb.TLFEphemeralPublicKeys
		keyLocation = WriterEPubKeys
	} else {
		index = -1 - info.EPubKeyIndex
		publicKeys = rkb.TLFReaderEphemeralPublicKeys
		keyLocation = ReaderEPubKeys
	}
	keyCount := len(publicKeys)
	if index >= keyCount {
		return EPubKeyLocationV2(0),
			0, kbfscrypto.TLFEphemeralPublicKey{},
			fmt.Errorf("Invalid key in %s with index %d >= %d",
				keyLocation, index, keyCount)
	}

	return keyLocation, index, publicKeys[index], nil
}

// DeviceKeyInfoMapV2 is a map from a user devices (identified by the
// KID of the corresponding device CryptPublicKey) to the
// TLF's symmetric secret key information.
type DeviceKeyInfoMapV2 map[keybase1.KID]TLFCryptKeyInfo

func (dkimV2 DeviceKeyInfoMapV2) fillInDeviceInfos(
	uid keybase1.UID, tlfCryptKey kbfscrypto.TLFCryptKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey, ePubIndex int,
	updatedDeviceKeys DevicePublicKeys) (
	serverHalves DeviceKeyServerHalves, err error) {
	serverHalves = make(DeviceKeyServerHalves, len(updatedDeviceKeys))
	// TODO: parallelize
	for k := range updatedDeviceKeys {
		// Skip existing entries, and only fill in new ones.
		if _, ok := dkimV2[k.KID()]; ok {
			continue
		}

		clientInfo, serverHalf, err := splitTLFCryptKey(
			uid, tlfCryptKey, ePrivKey, ePubIndex, k)
		if err != nil {
			return nil, err
		}

		dkimV2[k.KID()] = clientInfo
		serverHalves[k] = serverHalf
	}

	return serverHalves, nil
}

func (dkimV2 DeviceKeyInfoMapV2) toPublicKeys() DevicePublicKeys {
	publicKeys := make(DevicePublicKeys, len(dkimV2))
	for kid := range dkimV2 {
		publicKeys[kbfscrypto.MakeCryptPublicKey(kid)] = true
	}
	return publicKeys
}

// UserDeviceKeyInfoMapV2 maps a user's keybase UID to their
// DeviceKeyInfoMapV2.
type UserDeviceKeyInfoMapV2 map[keybase1.UID]DeviceKeyInfoMapV2

// ToPublicKeys converts this object to a UserDevicePublicKeys object.
func (udkimV2 UserDeviceKeyInfoMapV2) ToPublicKeys() UserDevicePublicKeys {
	publicKeys := make(UserDevicePublicKeys, len(udkimV2))
	for u, dkimV2 := range udkimV2 {
		publicKeys[u] = dkimV2.toPublicKeys()
	}
	return publicKeys
}

// RemoveDevicesNotIn removes any info for any device that is not
// contained in the given map of users and devices.
func (udkimV2 UserDeviceKeyInfoMapV2) RemoveDevicesNotIn(
	updatedUserKeys UserDevicePublicKeys) ServerHalfRemovalInfo {
	removalInfo := make(ServerHalfRemovalInfo)
	for uid, dkim := range udkimV2 {
		userRemoved := false
		deviceServerHalfIDs := make(DeviceServerHalfRemovalInfo)
		if deviceKeys, ok := updatedUserKeys[uid]; ok {
			for kid, info := range dkim {
				key := kbfscrypto.MakeCryptPublicKey(kid)
				if !deviceKeys[key] {
					delete(dkim, kid)
					deviceServerHalfIDs[key] = append(
						deviceServerHalfIDs[key],
						info.ServerHalfID)
				}
			}

			if len(deviceServerHalfIDs) == 0 {
				continue
			}
		} else {
			// The user was completely removed, which
			// shouldn't happen but might as well make it
			// work just in case.
			userRemoved = true
			for kid, info := range dkim {
				key := kbfscrypto.MakeCryptPublicKey(kid)
				deviceServerHalfIDs[key] = append(
					deviceServerHalfIDs[key],
					info.ServerHalfID)
			}

			delete(udkimV2, uid)
		}

		removalInfo[uid] = UserServerHalfRemovalInfo{
			UserRemoved:         userRemoved,
			DeviceServerHalfIDs: deviceServerHalfIDs,
		}
	}

	return removalInfo
}

// FillInUserInfos fills in this map from the given info.
func (udkimV2 UserDeviceKeyInfoMapV2) FillInUserInfos(
	newIndex int, updatedUserKeys UserDevicePublicKeys,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKey kbfscrypto.TLFCryptKey) (
	serverHalves UserDeviceKeyServerHalves, err error) {
	serverHalves = make(UserDeviceKeyServerHalves, len(updatedUserKeys))
	for u, updatedDeviceKeys := range updatedUserKeys {
		if _, ok := udkimV2[u]; !ok {
			udkimV2[u] = DeviceKeyInfoMapV2{}
		}

		deviceServerHalves, err := udkimV2[u].fillInDeviceInfos(
			u, tlfCryptKey, ePrivKey, newIndex,
			updatedDeviceKeys)
		if err != nil {
			return nil, err
		}
		if len(deviceServerHalves) > 0 {
			serverHalves[u] = deviceServerHalves
		}
	}
	return serverHalves, nil
}

// All section references below are to https://keybase.io/docs/crypto/kbfs
// (version 1.8).

// TLFWriterKeyBundleV2 is a bundle of all the writer keys for a top-level
// folder.
type TLFWriterKeyBundleV2 struct {
	// Maps from each writer to their crypt key bundle.
	WKeys UserDeviceKeyInfoMapV2

	// M_f as described in § 4.1.1.
	TLFPublicKey kbfscrypto.TLFPublicKey `codec:"pubKey"`

	// M_e as described in § 4.1.1.  Because devices can be added
	// into the key generation after it is initially created (so
	// those devices can get access to existing data), we track
	// multiple ephemeral public keys; the one used by a
	// particular device is specified by EPubKeyIndex in its
	// TLFCryptoKeyInfo struct.
	TLFEphemeralPublicKeys kbfscrypto.TLFEphemeralPublicKeys `codec:"ePubKey"`

	codec.UnknownFieldSetHandler
}

// IsWriter returns true if the given user device is in the writer set.
func (wkb TLFWriterKeyBundleV2) IsWriter(user keybase1.UID, deviceKey kbfscrypto.CryptPublicKey) bool {
	_, ok := wkb.WKeys[user][deviceKey.KID()]
	return ok
}

// TLFWriterKeyGenerationsV2 stores a slice of TLFWriterKeyBundleV2,
// where the last element is the current generation.
type TLFWriterKeyGenerationsV2 []TLFWriterKeyBundleV2

// LatestKeyGeneration returns the current key generation for this TLF.
func (wkg TLFWriterKeyGenerationsV2) LatestKeyGeneration() KeyGen {
	return KeyGen(len(wkg))
}

// IsWriter returns whether or not the user+device is an authorized writer
// for the latest generation.
func (wkg TLFWriterKeyGenerationsV2) IsWriter(user keybase1.UID, deviceKey kbfscrypto.CryptPublicKey) bool {
	keyGen := wkg.LatestKeyGeneration()
	if keyGen < 1 {
		return false
	}
	return wkg[keyGen-1].IsWriter(user, deviceKey)
}

// ToTLFWriterKeyBundleV3 converts a TLFWriterKeyGenerationsV2 to a TLFWriterKeyBundleV3.
func (wkg TLFWriterKeyGenerationsV2) ToTLFWriterKeyBundleV3(
	codec kbfscodec.Codec,
	tlfCryptKeyGetter func() ([]kbfscrypto.TLFCryptKey, error)) (
	TLFWriterKeyBundleV2, TLFWriterKeyBundleV3, error) {
	keyGen := wkg.LatestKeyGeneration()
	if keyGen < FirstValidKeyGen {
		return TLFWriterKeyBundleV2{}, TLFWriterKeyBundleV3{},
			errors.New("No key generations to convert")
	}

	// Copy the latest UserDeviceKeyInfoMap.
	wkbV2 := wkg[keyGen-FirstValidKeyGen]
	ePubKeyCount := len(wkbV2.TLFEphemeralPublicKeys)
	udkimV3, err := writerUDKIMV2ToV3(codec, wkbV2.WKeys, ePubKeyCount)
	if err != nil {
		return TLFWriterKeyBundleV2{}, TLFWriterKeyBundleV3{}, err
	}
	wkbV3 := TLFWriterKeyBundleV3{
		Keys: udkimV3,
		TLFEphemeralPublicKeys: make(
			kbfscrypto.TLFEphemeralPublicKeys, ePubKeyCount),
		TLFPublicKey: wkbV2.TLFPublicKey,
	}
	// Copy all of the TLFEphemeralPublicKeys at this generation.
	copy(wkbV3.TLFEphemeralPublicKeys[:], wkbV2.TLFEphemeralPublicKeys)

	if keyGen > FirstValidKeyGen {
		// Fetch all of the TLFCryptKeys.
		keys, err := tlfCryptKeyGetter()
		if err != nil {
			return TLFWriterKeyBundleV2{}, TLFWriterKeyBundleV3{}, err
		}
		// Sanity check.
		if len(keys) != int(keyGen) {
			return TLFWriterKeyBundleV2{}, TLFWriterKeyBundleV3{},
				fmt.Errorf("expected %d keys, found %d", keyGen, len(keys))
		}
		// Save the current key.
		currKey := keys[len(keys)-1]
		// Get rid of the most current generation as that's in the UserDeviceKeyInfoMap already.
		keys = keys[:len(keys)-1]
		// Encrypt the historic keys with the current key.
		wkbV3.EncryptedHistoricTLFCryptKeys, err = kbfscrypto.EncryptTLFCryptKeys(codec, keys, currKey)
		if err != nil {
			return TLFWriterKeyBundleV2{}, TLFWriterKeyBundleV3{}, err
		}
	}

	return wkbV2, wkbV3, nil
}

// TLFReaderKeyBundleV2 stores all the reader keys with reader
// permissions on a TLF.
type TLFReaderKeyBundleV2 struct {
	RKeys UserDeviceKeyInfoMapV2

	// M_e as described in § 4.1.1. Because devices can be added
	// into the key generation after it is initially created (so
	// those devices can get access to existing data), we track
	// multiple ephemeral public keys; the one used by a
	// particular device is specified by EPubKeyIndex in its
	// TLFCryptoKeyInfo struct.  This list is needed so a reader
	// rekey doesn't modify the writer metadata.
	TLFReaderEphemeralPublicKeys kbfscrypto.TLFEphemeralPublicKeys `codec:"readerEPubKey,omitempty"`

	codec.UnknownFieldSetHandler
}

// IsReader returns true if the given user device is in the reader set.
func (trb TLFReaderKeyBundleV2) IsReader(user keybase1.UID, deviceKey kbfscrypto.CryptPublicKey) bool {
	_, ok := trb.RKeys[user][deviceKey.KID()]
	return ok
}

// TLFReaderKeyGenerationsV2 stores a slice of TLFReaderKeyBundleV2,
// where the last element is the current generation.
type TLFReaderKeyGenerationsV2 []TLFReaderKeyBundleV2

// LatestKeyGeneration returns the current key generation for this TLF.
func (rkg TLFReaderKeyGenerationsV2) LatestKeyGeneration() KeyGen {
	return KeyGen(len(rkg))
}

// IsReader returns whether or not the user+device is an authorized reader
// for the latest generation.
func (rkg TLFReaderKeyGenerationsV2) IsReader(user keybase1.UID, deviceKey kbfscrypto.CryptPublicKey) bool {
	keyGen := rkg.LatestKeyGeneration()
	if keyGen < 1 {
		return false
	}
	return rkg[keyGen-1].IsReader(user, deviceKey)
}

// ToTLFReaderKeyBundleV3 converts a TLFReaderKeyGenerationsV2 to a TLFReaderkeyBundleV3.
func (rkg TLFReaderKeyGenerationsV2) ToTLFReaderKeyBundleV3(
	codec kbfscodec.Codec, wkb TLFWriterKeyBundleV2) (
	TLFReaderKeyBundleV3, error) {
	keyGen := rkg.LatestKeyGeneration()
	if keyGen < FirstValidKeyGen {
		return TLFReaderKeyBundleV3{}, errors.New("No key generations to convert")
	}

	rkbV3 := TLFReaderKeyBundleV3{
		Keys: make(UserDeviceKeyInfoMapV3),
	}

	// Copy the latest UserDeviceKeyInfoMap.
	rkb := rkg[keyGen-FirstValidKeyGen]

	// Copy all of the TLFReaderEphemeralPublicKeys.
	rkbV3.TLFEphemeralPublicKeys = make(kbfscrypto.TLFEphemeralPublicKeys,
		len(rkb.TLFReaderEphemeralPublicKeys))
	copy(rkbV3.TLFEphemeralPublicKeys[:], rkb.TLFReaderEphemeralPublicKeys)

	// Track a mapping of old writer ephemeral pubkey index to new
	// reader ephemeral pubkey index.
	pubKeyIndicesMap := make(map[int]int)

	// We need to copy these in a slightly annoying way to work around
	// the negative index hack. In V3 readers always have their ePubKey
	// in the TLFReaderEphemeralPublicKeys list. In V2 they only do if
	// the index is negative. Otherwise it's in the writer's list.
	for uid, dkim := range rkb.RKeys {
		dkimV3 := make(DeviceKeyInfoMapV3)
		for kid, info := range dkim {
			var infoCopy TLFCryptKeyInfo
			err := kbfscodec.Update(codec, &infoCopy, info)
			if err != nil {
				return TLFReaderKeyBundleV3{}, err
			}

			keyLocation, index, ePubKey, err :=
				GetEphemeralPublicKeyInfoV2(info, wkb, rkb)
			if err != nil {
				return TLFReaderKeyBundleV3{}, err
			}

			switch keyLocation {
			case WriterEPubKeys:
				// Map the old index in the writer list to a new index
				// at the end of the reader list.
				newIndex, ok := pubKeyIndicesMap[index]
				if !ok {
					rkbV3.TLFEphemeralPublicKeys =
						append(rkbV3.TLFEphemeralPublicKeys, ePubKey)
					// TODO: This index depends on
					// map iteration order, which
					// varies. Impose a consistent
					// order on these indices.
					newIndex = len(rkbV3.TLFEphemeralPublicKeys) - 1
					pubKeyIndicesMap[index] = newIndex
				}
				infoCopy.EPubKeyIndex = newIndex
			case ReaderEPubKeys:
				// Use the real index in the reader list.
				infoCopy.EPubKeyIndex = index
			default:
				return TLFReaderKeyBundleV3{}, fmt.Errorf("Unknown key location %s", keyLocation)
			}
			dkimV3[kbfscrypto.MakeCryptPublicKey(kid)] = infoCopy
		}
		rkbV3.Keys[uid] = dkimV3
	}
	return rkbV3, nil
}

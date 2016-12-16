// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"golang.org/x/net/context"
)

type ePubKeyTypeV2 int

const (
	writerEPubKey ePubKeyTypeV2 = 1
	readerEPubKey ePubKeyTypeV2 = 2
)

func (t ePubKeyTypeV2) String() string {
	switch t {
	case writerEPubKey:
		return "writer"
	case readerEPubKey:
		return "reader"
	default:
		return fmt.Sprintf("ePubKeyTypeV2(%d)", t)
	}
}

// getEphemeralPublicKeyInfoV2 encapsulates all the ugly logic needed to
// deal with the "negative hack" from
// BareRootMetadataV2.UpdateKeyGeneration.
func getEphemeralPublicKeyInfoV2(info TLFCryptKeyInfo,
	wkb TLFWriterKeyBundleV2, rkb TLFReaderKeyBundleV2) (
	keyType ePubKeyTypeV2, index int,
	ePubKey kbfscrypto.TLFEphemeralPublicKey, err error) {
	var publicKeys kbfscrypto.TLFEphemeralPublicKeys
	if info.EPubKeyIndex >= 0 {
		index = info.EPubKeyIndex
		publicKeys = wkb.TLFEphemeralPublicKeys
		keyType = writerEPubKey
	} else {
		index = -1 - info.EPubKeyIndex
		publicKeys = rkb.TLFReaderEphemeralPublicKeys
		keyType = readerEPubKey
	}
	keyCount := len(publicKeys)
	if index >= keyCount {
		return ePubKeyTypeV2(0), 0, kbfscrypto.TLFEphemeralPublicKey{},
			fmt.Errorf("Invalid %s key index %d >= %d",
				keyType, index, keyCount)
	}

	return keyType, index, publicKeys[index], nil
}

// DeviceKeyInfoMapV2 is a map from a user devices (identified by the
// KID of the corresponding device CryptPublicKey) to the
// TLF's symmetric secret key information.
type DeviceKeyInfoMapV2 map[keybase1.KID]TLFCryptKeyInfo

func (dkimV2 DeviceKeyInfoMapV2) fillInDeviceInfos(crypto cryptoPure,
	uid keybase1.UID, tlfCryptKey kbfscrypto.TLFCryptKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey, ePubIndex int,
	publicKeys map[kbfscrypto.CryptPublicKey]bool) (
	serverHalves DeviceKeyServerHalves, err error) {
	serverHalves = make(DeviceKeyServerHalves, len(publicKeys))
	// TODO: parallelize
	for k := range publicKeys {
		// Skip existing entries, and only fill in new ones.
		if _, ok := dkimV2[k.KID()]; ok {
			continue
		}

		clientInfo, serverHalf, err := splitTLFCryptKey(
			crypto, uid, tlfCryptKey, ePrivKey, ePubIndex, k)
		if err != nil {
			return nil, err
		}

		dkimV2[k.KID()] = clientInfo
		serverHalves[k] = serverHalf
	}

	return serverHalves, nil
}

func (dkimV2 DeviceKeyInfoMapV2) toDKIM(codec kbfscodec.Codec) (
	DeviceKeyInfoMap, error) {
	dkim := make(DeviceKeyInfoMap, len(dkimV2))
	for kid, info := range dkimV2 {
		var infoCopy TLFCryptKeyInfo
		err := kbfscodec.Update(codec, &infoCopy, info)
		if err != nil {
			return nil, err
		}
		dkim[kbfscrypto.MakeCryptPublicKey(kid)] = infoCopy
	}
	return dkim, nil
}

func dkimToV2(codec kbfscodec.Codec, dkim DeviceKeyInfoMap) (
	DeviceKeyInfoMapV2, error) {
	dkimV2 := make(DeviceKeyInfoMapV2, len(dkim))
	for key, info := range dkim {
		var infoCopy TLFCryptKeyInfo
		err := kbfscodec.Update(codec, &infoCopy, info)
		if err != nil {
			return nil, err
		}
		dkimV2[key.KID()] = infoCopy
	}
	return dkimV2, nil
}

// UserDeviceKeyInfoMapV2 maps a user's keybase UID to their
// DeviceKeyInfoMapV2.
type UserDeviceKeyInfoMapV2 map[keybase1.UID]DeviceKeyInfoMapV2

func (udkimV2 UserDeviceKeyInfoMapV2) toUDKIM(
	codec kbfscodec.Codec) (UserDeviceKeyInfoMap, error) {
	udkim := make(UserDeviceKeyInfoMap, len(udkimV2))
	for u, dkimV2 := range udkimV2 {
		dkim, err := dkimV2.toDKIM(codec)
		if err != nil {
			return nil, err
		}
		udkim[u] = dkim
	}
	return udkim, nil
}

func udkimToV2(codec kbfscodec.Codec, udkim UserDeviceKeyInfoMap) (
	UserDeviceKeyInfoMapV2, error) {
	udkimV2 := make(UserDeviceKeyInfoMapV2, len(udkim))
	for u, dkim := range udkim {
		dkimV2, err := dkimToV2(codec, dkim)
		if err != nil {
			return nil, err
		}
		udkimV2[u] = dkimV2
	}
	return udkimV2, nil
}

// removeDevicesNotIn removes any info for any device that is not
// contained in the given map of users and devices.
func (udkimV2 UserDeviceKeyInfoMapV2) removeDevicesNotIn(
	keys UserDevicePublicKeys) ServerHalfRemovalInfo {
	removalInfo := make(ServerHalfRemovalInfo)
	for uid, dkim := range udkimV2 {
		userKIDs := make(map[keybase1.KID]bool, len(keys[uid]))
		for key := range keys[uid] {
			userKIDs[key.KID()] = true
		}

		deviceServerHalfIDs := make(deviceServerHalfRemovalInfo)

		for kid, info := range dkim {
			if !userKIDs[kid] {
				delete(dkim, kid)
				key := kbfscrypto.MakeCryptPublicKey(kid)
				deviceServerHalfIDs[key] = append(
					deviceServerHalfIDs[key],
					info.ServerHalfID)
			}
		}

		if len(deviceServerHalfIDs) == 0 {
			continue
		}

		userRemoved := false
		if len(dkim) == 0 {
			// The user was completely removed, which
			// shouldn't happen but might as well make it
			// work just in case.
			delete(udkimV2, uid)
			userRemoved = true
		}

		removalInfo[uid] = userServerHalfRemovalInfo{
			userRemoved:         userRemoved,
			deviceServerHalfIDs: deviceServerHalfIDs,
		}
	}

	return removalInfo
}

func (udkimV2 UserDeviceKeyInfoMapV2) fillInUserInfos(
	crypto cryptoPure, newIndex int, pubKeys UserDevicePublicKeys,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKey kbfscrypto.TLFCryptKey) (
	serverHalves UserDeviceKeyServerHalves, err error) {
	serverHalves = make(UserDeviceKeyServerHalves, len(pubKeys))
	for u, keys := range pubKeys {
		if _, ok := udkimV2[u]; !ok {
			udkimV2[u] = DeviceKeyInfoMapV2{}
		}

		deviceServerHalves, err := udkimV2[u].fillInDeviceInfos(
			crypto, u, tlfCryptKey, ePrivKey, newIndex, keys)
		if err != nil {
			return nil, err
		}
		if len(deviceServerHalves) > 0 {
			serverHalves[u] = deviceServerHalves
		}
	}
	return serverHalves, nil
}

// All section references below are to https://keybase.io/blog/kbfs-crypto
// (version 1.3).

// TLFWriterKeyBundleV2 is a bundle of all the writer keys for a top-level
// folder.
type TLFWriterKeyBundleV2 struct {
	// Maps from each writer to their crypt key bundle.
	WKeys UserDeviceKeyInfoMapV2

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
func (wkb TLFWriterKeyBundleV2) IsWriter(user keybase1.UID, deviceKID keybase1.KID) bool {
	_, ok := wkb.WKeys[user][deviceKID]
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
func (wkg TLFWriterKeyGenerationsV2) IsWriter(user keybase1.UID, deviceKID keybase1.KID) bool {
	keyGen := wkg.LatestKeyGeneration()
	if keyGen < 1 {
		return false
	}
	return wkg[keyGen-1].IsWriter(user, deviceKID)
}

// ToTLFWriterKeyBundleV3 converts a TLFWriterKeyGenerationsV2 to a TLFWriterKeyBundleV3.
//
// TODO: Add a unit test for this.
func (wkg TLFWriterKeyGenerationsV2) ToTLFWriterKeyBundleV3(
	ctx context.Context, codec kbfscodec.Codec, crypto cryptoPure,
	keyManager KeyManager, kmd KeyMetadata) (
	TLFWriterKeyBundleV2, TLFWriterKeyBundleV3, error) {
	keyGen := wkg.LatestKeyGeneration()
	if keyGen < FirstValidKeyGen {
		return TLFWriterKeyBundleV2{}, TLFWriterKeyBundleV3{},
			errors.New("No key generations to convert")
	}

	var wkbV3 TLFWriterKeyBundleV3

	// Copy the latest UserDeviceKeyInfoMap.
	wkbV2 := wkg[keyGen-FirstValidKeyGen]
	udkimV3, err := udkimV2ToV3(codec, wkbV2.WKeys)
	if err != nil {
		return TLFWriterKeyBundleV2{}, TLFWriterKeyBundleV3{}, err
	}
	wkbV3.Keys = udkimV3

	// Copy all of the TLFEphemeralPublicKeys at this generation.
	wkbV3.TLFEphemeralPublicKeys = make(kbfscrypto.TLFEphemeralPublicKeys,
		len(wkbV2.TLFEphemeralPublicKeys))
	copy(wkbV3.TLFEphemeralPublicKeys[:], wkbV2.TLFEphemeralPublicKeys)

	// Copy the current TLFPublicKey.
	wkbV3.TLFPublicKey = wkbV2.TLFPublicKey

	if keyGen > FirstValidKeyGen {
		// Fetch all of the TLFCryptKeys.
		keys, err := keyManager.GetTLFCryptKeyOfAllGenerations(ctx, kmd)
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
		wkbV3.EncryptedHistoricTLFCryptKeys, err = crypto.EncryptTLFCryptKeys(keys, currKey)
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

// TLFReaderKeyGenerationsV2 stores a slice of TLFReaderKeyBundleV2,
// where the last element is the current generation.
type TLFReaderKeyGenerationsV2 []TLFReaderKeyBundleV2

// LatestKeyGeneration returns the current key generation for this TLF.
func (rkg TLFReaderKeyGenerationsV2) LatestKeyGeneration() KeyGen {
	return KeyGen(len(rkg))
}

// IsReader returns whether or not the user+device is an authorized reader
// for the latest generation.
func (rkg TLFReaderKeyGenerationsV2) IsReader(user keybase1.UID, deviceKID keybase1.KID) bool {
	keyGen := rkg.LatestKeyGeneration()
	if keyGen < 1 {
		return false
	}
	return rkg[keyGen-1].IsReader(user, deviceKID)
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

			keyType, index, ePubKey, err := getEphemeralPublicKeyInfoV2(info, wkb, rkb)
			if err != nil {
				return TLFReaderKeyBundleV3{}, err
			}

			switch keyType {
			case writerEPubKey:
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
			case readerEPubKey:
				// Use the real index in the reader list.
				infoCopy.EPubKeyIndex = index
			default:
				return TLFReaderKeyBundleV3{}, fmt.Errorf("Unknown key type %s", keyType)
			}
			dkimV3[kbfscrypto.MakeCryptPublicKey(kid)] = infoCopy
		}
		rkbV3.Keys[uid] = dkimV3
	}
	return rkbV3, nil
}

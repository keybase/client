// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"encoding"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfshash"
)

// A lot of this code is duplicated from key_bundle_v3.go, except with
// DeviceKeyInfoMapV2 (keyed by keybase1.KID) replaced with
// DeviceKeyInfoMapV3 (keyed by kbfscrypto.CryptPublicKey).

// DeviceKeyInfoMapV3 is a map from a user devices (identified by the
// corresponding device CryptPublicKey) to the TLF's symmetric secret
// key information.
type DeviceKeyInfoMapV3 map[kbfscrypto.CryptPublicKey]TLFCryptKeyInfo

func (dkimV3 DeviceKeyInfoMapV3) fillInDeviceInfo(crypto Crypto,
	uid keybase1.UID, tlfCryptKey kbfscrypto.TLFCryptKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey, ePubIndex int,
	publicKeys []kbfscrypto.CryptPublicKey) (
	serverMap map[keybase1.KID]kbfscrypto.TLFCryptKeyServerHalf,
	err error) {
	serverMap = make(map[keybase1.KID]kbfscrypto.TLFCryptKeyServerHalf)
	// TODO: parallelize
	for _, k := range publicKeys {
		// Skip existing entries, and only fill in new ones
		if _, ok := dkimV3[k]; ok {
			continue
		}

		clientInfo, serverHalf, err := splitTLFCryptKey(
			crypto, uid, tlfCryptKey, ePrivKey, ePubIndex, k)
		if err != nil {
			return nil, err
		}

		dkimV3[k] = clientInfo
		serverMap[k.KID()] = serverHalf
	}

	return serverMap, nil
}

func (dkimV3 DeviceKeyInfoMapV3) toDKIM(codec kbfscodec.Codec) (
	DeviceKeyInfoMap, error) {
	dkim := make(DeviceKeyInfoMap)
	for key, info := range dkimV3 {
		var infoCopy TLFCryptKeyInfo
		err := kbfscodec.Update(codec, &infoCopy, info)
		if err != nil {
			return nil, err
		}
		dkim[key] = infoCopy
	}
	return dkim, nil
}

func dkimToV3(codec kbfscodec.Codec, dkim DeviceKeyInfoMap) (
	DeviceKeyInfoMapV3, error) {
	dkimV3 := make(DeviceKeyInfoMapV3)
	for key, info := range dkim {
		var infoCopy TLFCryptKeyInfo
		err := kbfscodec.Update(codec, &infoCopy, info)
		if err != nil {
			return nil, err
		}
		dkimV3[key] = infoCopy
	}
	return dkimV3, nil
}

func deviceKeyInfoMapToV3(dkim DeviceKeyInfoMap) DeviceKeyInfoMapV3 {
	return DeviceKeyInfoMapV3(dkim)
}

// UserDeviceKeyInfoMapV3 maps a user's keybase UID to their
// DeviceKeyInfoMapV3.
type UserDeviceKeyInfoMapV3 map[keybase1.UID]DeviceKeyInfoMapV3

func (udkimV3 UserDeviceKeyInfoMapV3) toUDKIM(
	codec kbfscodec.Codec) (UserDeviceKeyInfoMap, error) {
	udkim := make(UserDeviceKeyInfoMap)
	for u, dkimV3 := range udkimV3 {
		dkim, err := dkimV3.toDKIM(codec)
		if err != nil {
			return nil, err
		}
		udkim[u] = dkim
	}
	return udkim, nil
}

func udkimToV3(codec kbfscodec.Codec, udkim UserDeviceKeyInfoMap) (
	UserDeviceKeyInfoMapV3, error) {
	udkimV3 := make(UserDeviceKeyInfoMapV3)
	for u, dkim := range udkim {
		dkimV3, err := dkimToV3(codec, dkim)
		if err != nil {
			return nil, err
		}
		udkimV3[u] = dkimV3
	}
	return udkimV3, nil
}

func udkimV2ToV3(codec kbfscodec.Codec, udkimV2 UserDeviceKeyInfoMapV2) (
	UserDeviceKeyInfoMapV3, error) {
	udkim, err := udkimV2.toUDKIM(codec)
	if err != nil {
		return nil, err
	}
	return udkimToV3(codec, udkim)
}

// removeDevicesNotIn removes any info for any device that is not
// contained in the given map of users and devices.
func (udkimV3 UserDeviceKeyInfoMapV3) removeDevicesNotIn(
	keys map[keybase1.UID][]kbfscrypto.CryptPublicKey) ServerHalfRemovalInfo {
	removalInfo := make(ServerHalfRemovalInfo)
	for uid, dkim := range udkimV3 {
		userKeys := make(map[kbfscrypto.CryptPublicKey]bool)
		for _, key := range keys[uid] {
			userKeys[key] = true
		}

		deviceServerHalfIDs := make(deviceServerHalfRemovalInfo)

		for key, info := range dkim {
			if !userKeys[key] {
				delete(dkim, key)
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
			delete(udkimV3, uid)
			userRemoved = true
		}

		removalInfo[uid] = userServerHalfRemovalInfo{
			userRemoved:         userRemoved,
			deviceServerHalfIDs: deviceServerHalfIDs,
		}
	}

	return removalInfo
}

// All section references below are to https://keybase.io/blog/kbfs-crypto
// (version 1.3).

// TLFWriterKeyBundleV3 is a bundle of writer keys and historic
// symmetric encryption keys for a top-level folder.
type TLFWriterKeyBundleV3 struct {
	// Maps from each user to their crypt key bundle for the current generation.
	Keys UserDeviceKeyInfoMapV3 `codec:"wKeys"`

	// M_f as described in 4.1.1 of https://keybase.io/blog/kbfs-crypto.
	TLFPublicKey kbfscrypto.TLFPublicKey `codec:"pubKey"`

	// M_e as described in 4.1.1 of https://keybase.io/blog/kbfs-crypto.
	// Because devices can be added into the key generation after it
	// is initially created (so those devices can get access to
	// existing data), we track multiple ephemeral public keys; the
	// one used by a particular device is specified by EPubKeyIndex in
	// its TLFCryptoKeyInfo struct.
	TLFEphemeralPublicKeys kbfscrypto.TLFEphemeralPublicKeys `codec:"ePubKey"`

	// This is a time-ordered encrypted list of historic key generations.
	// It is encrypted with the latest generation of the TLF crypt key.
	EncryptedHistoricTLFCryptKeys EncryptedTLFCryptKeys `codec:"oldKeys"`

	codec.UnknownFieldSetHandler
}

// IsWriter returns true if the given user device is in the device set.
func (wkb TLFWriterKeyBundleV3) IsWriter(user keybase1.UID, deviceKID keybase1.KID) bool {
	_, ok := wkb.Keys[user][kbfscrypto.MakeCryptPublicKey(deviceKID)]
	return ok
}

// TLFWriterKeyBundleID is the hash of a serialized TLFWriterKeyBundle.
type TLFWriterKeyBundleID struct {
	h kbfshash.Hash
}

var _ encoding.BinaryMarshaler = TLFWriterKeyBundleID{}
var _ encoding.BinaryUnmarshaler = (*TLFWriterKeyBundleID)(nil)

// TLFWriterKeyBundleIDFromBytes creates a new TLFWriterKeyBundleID from the given bytes.
// If the returned error is nil, the returned TLFWriterKeyBundleID is valid.
func TLFWriterKeyBundleIDFromBytes(data []byte) (TLFWriterKeyBundleID, error) {
	h, err := kbfshash.HashFromBytes(data)
	if err != nil {
		return TLFWriterKeyBundleID{}, err
	}
	return TLFWriterKeyBundleID{h}, nil
}

// TLFWriterKeyBundleIDFromString creates a new TLFWriterKeyBundleID from the given string.
// If the returned error is nil, the returned TLFWriterKeyBundleID is valid.
func TLFWriterKeyBundleIDFromString(id string) (TLFWriterKeyBundleID, error) {
	if len(id) == 0 {
		return TLFWriterKeyBundleID{}, nil
	}
	h, err := kbfshash.HashFromString(id)
	if err != nil {
		return TLFWriterKeyBundleID{}, err
	}
	return TLFWriterKeyBundleID{h}, nil
}

// Bytes returns the bytes of the TLFWriterKeyBundleID.
func (h TLFWriterKeyBundleID) Bytes() []byte {
	return h.h.Bytes()
}

// String returns the string form of the TLFWriterKeyBundleID.
func (h TLFWriterKeyBundleID) String() string {
	return h.h.String()
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for
// TLFWriterKeyBundleID. Returns an error if the TLFWriterKeyBundleID is invalid and not the
// zero TLFWriterKeyBundleID.
func (h TLFWriterKeyBundleID) MarshalBinary() (data []byte, err error) {
	return h.h.MarshalBinary()
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for TLFWriterKeyBundleID. Returns an error if the given byte array is non-empty and
// the TLFWriterKeyBundleID is invalid.
func (h *TLFWriterKeyBundleID) UnmarshalBinary(data []byte) error {
	return h.h.UnmarshalBinary(data)
}

// IsNil returns true if the ID is unset.
func (h TLFWriterKeyBundleID) IsNil() bool {
	return h == TLFWriterKeyBundleID{}
}

// TLFReaderKeyBundleV3 stores all the reader keys with reader
// permissions on a TLF.
type TLFReaderKeyBundleV3 struct {
	Keys UserDeviceKeyInfoMapV3 `codec:"rKeys,omitempty"`

	// M_e as described in 4.1.1 of https://keybase.io/blog/kbfs-crypto.
	// Because devices can be added into the key generation after it
	// is initially created (so those devices can get access to
	// existing data), we track multiple ephemeral public keys; the
	// one used by a particular device is specified by EPubKeyIndex in
	// its TLFCryptoKeyInfo struct.
	// This list is needed so a reader rekey doesn't modify the writer
	// metadata.
	TLFEphemeralPublicKeys kbfscrypto.TLFEphemeralPublicKeys `codec:"rEPubKey,omitempty"`

	codec.UnknownFieldSetHandler
}

// IsReader returns true if the given user device is in the reader set.
func (trb TLFReaderKeyBundleV3) IsReader(user keybase1.UID, deviceKID keybase1.KID) bool {
	_, ok := trb.Keys[user][kbfscrypto.MakeCryptPublicKey(deviceKID)]
	return ok
}

// TLFReaderKeyBundleID is the hash of a serialized TLFReaderKeyBundle.
type TLFReaderKeyBundleID struct {
	h kbfshash.Hash
}

var _ encoding.BinaryMarshaler = TLFReaderKeyBundleID{}
var _ encoding.BinaryUnmarshaler = (*TLFReaderKeyBundleID)(nil)

// TLFReaderKeyBundleIDFromBytes creates a new TLFReaderKeyBundleID from the given bytes.
// If the returned error is nil, the returned TLFReaderKeyBundleID is valid.
func TLFReaderKeyBundleIDFromBytes(data []byte) (TLFReaderKeyBundleID, error) {
	h, err := kbfshash.HashFromBytes(data)
	if err != nil {
		return TLFReaderKeyBundleID{}, err
	}
	return TLFReaderKeyBundleID{h}, nil
}

// TLFReaderKeyBundleIDFromString creates a new TLFReaderKeyBundleID from the given string.
// If the returned error is nil, the returned TLFReaderKeyBundleID is valid.
func TLFReaderKeyBundleIDFromString(id string) (TLFReaderKeyBundleID, error) {
	if len(id) == 0 {
		return TLFReaderKeyBundleID{}, nil
	}
	h, err := kbfshash.HashFromString(id)
	if err != nil {
		return TLFReaderKeyBundleID{}, err
	}
	return TLFReaderKeyBundleID{h}, nil
}

// Bytes returns the bytes of the TLFReaderKeyBundleID.
func (h TLFReaderKeyBundleID) Bytes() []byte {
	return h.h.Bytes()
}

// String returns the string form of the TLFReaderKeyBundleID.
func (h TLFReaderKeyBundleID) String() string {
	return h.h.String()
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for
// TLFReaderKeyBundleID. Returns an error if the TLFReaderKeyBundleID is invalid and not the
// zero TLFReaderKeyBundleID.
func (h TLFReaderKeyBundleID) MarshalBinary() (data []byte, err error) {
	return h.h.MarshalBinary()
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface
// for TLFReaderKeyBundleID. Returns an error if the given byte array is non-empty and
// the TLFReaderKeyBundleID is invalid.
func (h *TLFReaderKeyBundleID) UnmarshalBinary(data []byte) error {
	return h.h.UnmarshalBinary(data)
}

// IsNil returns true if the ID is unset.
func (h TLFReaderKeyBundleID) IsNil() bool {
	return h == TLFReaderKeyBundleID{}
}

func fillInDevicesAndServerMapV3(crypto Crypto, newIndex int,
	cryptKeys map[keybase1.UID][]kbfscrypto.CryptPublicKey,
	keyInfoMap UserDeviceKeyInfoMapV3,
	ePubKey kbfscrypto.TLFEphemeralPublicKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKey kbfscrypto.TLFCryptKey, newServerKeys serverKeyMap) error {
	for u, keys := range cryptKeys {
		if _, ok := keyInfoMap[u]; !ok {
			keyInfoMap[u] = DeviceKeyInfoMapV3{}
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

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
	"github.com/pkg/errors"
)

// A lot of this code is duplicated from key_bundle_v3.go, except with
// DeviceKeyInfoMapV2 (keyed by keybase1.KID) replaced with
// DeviceKeyInfoMapV3 (keyed by kbfscrypto.CryptPublicKey).

// DeviceKeyInfoMapV3 is a map from a user devices (identified by the
// corresponding device CryptPublicKey) to the TLF's symmetric secret
// key information.
type DeviceKeyInfoMapV3 map[kbfscrypto.CryptPublicKey]TLFCryptKeyInfo

func (dkimV3 DeviceKeyInfoMapV3) fillInDeviceInfos(crypto cryptoPure,
	uid keybase1.UID, tlfCryptKey kbfscrypto.TLFCryptKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey, ePubIndex int,
	publicKeys map[kbfscrypto.CryptPublicKey]bool) (
	serverHalves DeviceKeyServerHalves, err error) {
	serverHalves = make(DeviceKeyServerHalves, len(publicKeys))
	// TODO: parallelize
	for k := range publicKeys {
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
		serverHalves[k] = serverHalf
	}

	return serverHalves, nil
}

func (dkimV3 DeviceKeyInfoMapV3) toDKIM(codec kbfscodec.Codec) (
	DeviceKeyInfoMap, error) {
	dkim := make(DeviceKeyInfoMap, len(dkimV3))
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
	dkimV3 := make(DeviceKeyInfoMapV3, len(dkim))
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

// UserDeviceKeyInfoMapV3 maps a user's keybase UID to their
// DeviceKeyInfoMapV3.
type UserDeviceKeyInfoMapV3 map[keybase1.UID]DeviceKeyInfoMapV3

func (udkimV3 UserDeviceKeyInfoMapV3) toUDKIM(
	codec kbfscodec.Codec) (UserDeviceKeyInfoMap, error) {
	udkim := make(UserDeviceKeyInfoMap, len(udkimV3))
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
	udkimV3 := make(UserDeviceKeyInfoMapV3, len(udkim))
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
	keys UserDevicePublicKeys) ServerHalfRemovalInfo {
	removalInfo := make(ServerHalfRemovalInfo)
	for uid, dkim := range udkimV3 {
		deviceServerHalfIDs := make(deviceServerHalfRemovalInfo)

		for key, info := range dkim {
			if !keys[uid][key] {
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

func (udkimV3 UserDeviceKeyInfoMapV3) fillInUserInfos(
	crypto cryptoPure, newIndex int, pubKeys UserDevicePublicKeys,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey,
	tlfCryptKey kbfscrypto.TLFCryptKey) (
	serverHalves UserDeviceKeyServerHalves, err error) {
	serverHalves = make(UserDeviceKeyServerHalves, len(pubKeys))
	for u, keys := range pubKeys {
		if _, ok := udkimV3[u]; !ok {
			udkimV3[u] = DeviceKeyInfoMapV3{}
		}

		deviceServerHalves, err := udkimV3[u].fillInDeviceInfos(
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

// DeserializeTLFWriterKeyBundleV3 deserializes a TLFWriterKeyBundleV3
// from the given path and returns it.
func DeserializeTLFWriterKeyBundleV3(codec kbfscodec.Codec, path string) (
	TLFWriterKeyBundleV3, error) {
	var wkb TLFWriterKeyBundleV3
	err := kbfscodec.DeserializeFromFile(codec, path, &wkb)
	if err != nil {
		return TLFWriterKeyBundleV3{}, err
	}
	if len(wkb.Keys) == 0 {
		return TLFWriterKeyBundleV3{}, errors.New(
			"Writer key bundle with no keys (Deserialize)")
	}
	return wkb, nil
}

// IsWriter returns true if the given user device is in the device set.
func (wkb TLFWriterKeyBundleV3) IsWriter(user keybase1.UID, deviceKID keybase1.KID) bool {
	_, ok := wkb.Keys[user][kbfscrypto.MakeCryptPublicKey(deviceKID)]
	return ok
}

// DeepCopy creates a deep copy of this key bundle.
func (wkb TLFWriterKeyBundleV3) DeepCopy(codec kbfscodec.Codec) (
	TLFWriterKeyBundleV3, error) {
	if len(wkb.Keys) == 0 {
		return TLFWriterKeyBundleV3{}, errors.New(
			"Writer key bundle with no keys (DeepCopy)")
	}
	var wkbCopy TLFWriterKeyBundleV3
	if err := kbfscodec.Update(codec, &wkbCopy, wkb); err != nil {
		return TLFWriterKeyBundleV3{}, err
	}
	return wkbCopy, nil
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

// DeserializeTLFReaderKeyBundleV3 deserializes a TLFReaderKeyBundleV3
// from the given path and returns it.
func DeserializeTLFReaderKeyBundleV3(codec kbfscodec.Codec, path string) (
	TLFReaderKeyBundleV3, error) {
	var rkb TLFReaderKeyBundleV3
	err := kbfscodec.DeserializeFromFile(codec, path, &rkb)
	if err != nil {
		return TLFReaderKeyBundleV3{}, err
	}
	if len(rkb.Keys) == 0 {
		rkb.Keys = make(UserDeviceKeyInfoMapV3)
	}
	return rkb, nil
}

// IsReader returns true if the given user device is in the reader set.
func (rkb TLFReaderKeyBundleV3) IsReader(user keybase1.UID, deviceKID keybase1.KID) bool {
	_, ok := rkb.Keys[user][kbfscrypto.MakeCryptPublicKey(deviceKID)]
	return ok
}

// DeepCopy creates a deep copy of this key bundle.
func (rkb TLFReaderKeyBundleV3) DeepCopy(codec kbfscodec.Codec) (
	TLFReaderKeyBundleV3, error) {
	var rkbCopy TLFReaderKeyBundleV3
	if err := kbfscodec.Update(codec, &rkbCopy, rkb); err != nil {
		return TLFReaderKeyBundleV3{}, err
	}
	if len(rkbCopy.Keys) == 0 {
		rkbCopy.Keys = make(UserDeviceKeyInfoMapV3)
	}
	return rkbCopy, nil
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

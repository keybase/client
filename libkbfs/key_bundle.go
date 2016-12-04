// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfshash"
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

// TODO: UserDeviceKeyInfoMap and DeviceKeyInfoMap exist only because
// of BareRootMetadata.GetUserDeviceKeyInfoMaps. That will eventually
// go away, so remove these types once that happens.

// DeviceKeyInfoMap is a map from a user devices (identified by the
// corresponding device CryptPublicKey) to the TLF's symmetric secret
// key information.
type DeviceKeyInfoMap map[kbfscrypto.CryptPublicKey]TLFCryptKeyInfo

// UserDeviceKeyInfoMap maps a user's keybase UID to their
// DeviceKeyInfoMap.
type UserDeviceKeyInfoMap map[keybase1.UID]DeviceKeyInfoMap

type serverKeyMap map[keybase1.UID]map[keybase1.KID]kbfscrypto.TLFCryptKeyServerHalf

// splitTLFCryptKey splits the given TLFCryptKey into two parts -- the
// client-side part (which is encrypted with the given keys), and the
// server-side part, which will be uploaded to the server.
func splitTLFCryptKey(crypto Crypto, uid keybase1.UID,
	tlfCryptKey kbfscrypto.TLFCryptKey,
	ePrivKey kbfscrypto.TLFEphemeralPrivateKey, ePubIndex int,
	pubKey kbfscrypto.CryptPublicKey) (
	TLFCryptKeyInfo, kbfscrypto.TLFCryptKeyServerHalf, error) {
	//    * create a new random server half
	//    * mask it with the key to get the client half
	//    * encrypt the client half
	var serverHalf kbfscrypto.TLFCryptKeyServerHalf
	serverHalf, err := crypto.MakeRandomTLFCryptKeyServerHalf()
	if err != nil {
		return TLFCryptKeyInfo{}, kbfscrypto.TLFCryptKeyServerHalf{}, err
	}

	var clientHalf kbfscrypto.TLFCryptKeyClientHalf
	clientHalf, err = crypto.MaskTLFCryptKey(serverHalf, tlfCryptKey)
	if err != nil {
		return TLFCryptKeyInfo{}, kbfscrypto.TLFCryptKeyServerHalf{}, err
	}

	var encryptedClientHalf EncryptedTLFCryptKeyClientHalf
	encryptedClientHalf, err =
		crypto.EncryptTLFCryptKeyClientHalf(ePrivKey, pubKey, clientHalf)
	if err != nil {
		return TLFCryptKeyInfo{}, kbfscrypto.TLFCryptKeyServerHalf{}, err
	}

	var serverHalfID TLFCryptKeyServerHalfID
	serverHalfID, err =
		crypto.GetTLFCryptKeyServerHalfID(uid, pubKey.KID(), serverHalf)
	if err != nil {
		return TLFCryptKeyInfo{}, kbfscrypto.TLFCryptKeyServerHalf{}, err
	}

	clientInfo := TLFCryptKeyInfo{
		ClientHalf:   encryptedClientHalf,
		ServerHalfID: serverHalfID,
		EPubKeyIndex: ePubIndex,
	}
	return clientInfo, serverHalf, nil
}

type deviceServerHalfRemovalInfo map[kbfscrypto.CryptPublicKey][]TLFCryptKeyServerHalfID

// userServerHalfRemovalInfo contains a map from devices (identified
// by its crypt public key) to a list of IDs for key server halves to
// remove (one per key generation). For logging purposes, it also
// contains a bool indicating whether all of the user's devices were
// removed.
type userServerHalfRemovalInfo struct {
	userRemoved         bool
	deviceServerHalfIDs deviceServerHalfRemovalInfo
}

// addGeneration merges the keys in genInfo (which must be one per
// device) into ri. genInfo must have the same userRemoved value and
// keys as ri.
func (ri userServerHalfRemovalInfo) addGeneration(
	uid keybase1.UID, genInfo userServerHalfRemovalInfo) error {
	if ri.userRemoved != genInfo.userRemoved {
		return fmt.Errorf(
			"userRemoved=%t != generation userRemoved=%t for user %s",
			ri.userRemoved, genInfo.userRemoved, uid)
	}

	if len(ri.deviceServerHalfIDs) != len(genInfo.deviceServerHalfIDs) {
		return fmt.Errorf(
			"device count=%d != generation device count=%d for user %s",
			len(ri.deviceServerHalfIDs),
			len(genInfo.deviceServerHalfIDs), uid)
	}

	idCount := -1
	for key, serverHalfIDs := range genInfo.deviceServerHalfIDs {
		if idCount == -1 {
			idCount = len(ri.deviceServerHalfIDs[key])
		} else {
			localIDCount := len(ri.deviceServerHalfIDs[key])
			if localIDCount != idCount {
				return fmt.Errorf(
					"expected %d keys, got %d for user %s and device %s",
					idCount, localIDCount, uid, key)
			}
		}

		if len(serverHalfIDs) != 1 {
			return fmt.Errorf(
				"expected exactly one key, got %d for user %s and device %s",
				len(serverHalfIDs), uid, key)
		}
		if _, ok := ri.deviceServerHalfIDs[key]; !ok {
			return fmt.Errorf(
				"no generation info for user %s and device %s",
				uid, key)
		}
		ri.deviceServerHalfIDs[key] = append(
			ri.deviceServerHalfIDs[key], serverHalfIDs[0])
	}

	return nil
}

// ServerHalfRemovalInfo is a map from users to and devices to a list
// of server half IDs to remove from the server.
type ServerHalfRemovalInfo map[keybase1.UID]userServerHalfRemovalInfo

// addGeneration merges the keys in genInfo (which must be one per
// device) into info. genInfo must have the same users as info.
func (info ServerHalfRemovalInfo) addGeneration(
	genInfo ServerHalfRemovalInfo) error {
	if len(info) != len(genInfo) {
		return fmt.Errorf(
			"user count=%d != generation user count=%d",
			len(info), len(genInfo))
	}

	for uid, removalInfo := range genInfo {
		if _, ok := info[uid]; !ok {
			return fmt.Errorf("no generation info for user %s", uid)
		}
		err := info[uid].addGeneration(uid, removalInfo)
		if err != nil {
			return err
		}
	}
	return nil
}

// mergeUsers returns a ServerHalfRemovalInfo that contains all the
// users in info and other, which must be disjoint. This isn't a deep
// copy.
func (info ServerHalfRemovalInfo) mergeUsers(
	other ServerHalfRemovalInfo) (ServerHalfRemovalInfo, error) {
	merged := make(ServerHalfRemovalInfo)
	for uid, removalInfo := range info {
		merged[uid] = removalInfo
	}
	for uid, removalInfo := range other {
		if _, ok := merged[uid]; ok {
			return nil, fmt.Errorf(
				"user %s is in both ServerHalfRemovalInfos",
				uid)
		}
		merged[uid] = removalInfo
	}
	return merged, nil
}

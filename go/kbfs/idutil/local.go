// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package idutil

import (
	"strings"

	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
)

// LocalUser represents a fake KBFS user, useful for testing.
type LocalUser struct {
	UserInfo
	Asserts []string
	// Index into UserInfo.CryptPublicKeys.
	CurrentCryptPublicKeyIndex int
	// Index into UserInfo.VerifyingKeys.
	CurrentVerifyingKeyIndex int
	// Unverified keys.
	UnverifiedKeys []keybase1.PublicKey
}

// GetCurrentCryptPublicKey returns this LocalUser's public encryption key.
func (lu *LocalUser) GetCurrentCryptPublicKey() kbfscrypto.CryptPublicKey {
	return lu.CryptPublicKeys[lu.CurrentCryptPublicKeyIndex]
}

// GetCurrentVerifyingKey returns this LocalUser's public signing key.
func (lu *LocalUser) GetCurrentVerifyingKey() kbfscrypto.VerifyingKey {
	return lu.VerifyingKeys[lu.CurrentVerifyingKeyIndex]
}

// MakeLocalUsers is a helper function to generate a list of
// LocalUsers suitable to use with KeybaseDaemonLocal.
func MakeLocalUsers(users []kbname.NormalizedUsername) []LocalUser {
	localUsers := make([]LocalUser, len(users))
	for i := 0; i < len(users); i++ {
		verifyingKey := MakeLocalUserVerifyingKeyOrBust(users[i])
		cryptPublicKey := MakeLocalUserCryptPublicKeyOrBust(users[i])
		localUsers[i] = LocalUser{
			UserInfo: UserInfo{
				Name:            users[i],
				UID:             keybase1.MakeTestUID(uint32(i + 1)),
				VerifyingKeys:   []kbfscrypto.VerifyingKey{verifyingKey},
				CryptPublicKeys: []kbfscrypto.CryptPublicKey{cryptPublicKey},
				KIDNames: map[keybase1.KID]string{
					verifyingKey.KID(): "dev1",
				},
			},
			CurrentCryptPublicKeyIndex: 0,
			CurrentVerifyingKeyIndex:   0,
		}
	}
	return localUsers
}

func verifyingKeysToPublicKeys(
	keys []kbfscrypto.VerifyingKey) []keybase1.PublicKey {
	publicKeys := make([]keybase1.PublicKey, len(keys))
	for i, key := range keys {
		publicKeys[i] = keybase1.PublicKey{
			KID:      key.KID(),
			IsSibkey: true,
		}
	}
	return publicKeys
}

func cryptPublicKeysToPublicKeys(
	keys []kbfscrypto.CryptPublicKey) []keybase1.PublicKey {
	publicKeys := make([]keybase1.PublicKey, len(keys))
	for i, key := range keys {
		publicKeys[i] = keybase1.PublicKey{
			KID:      key.KID(),
			IsSibkey: false,
		}
	}
	return publicKeys
}

// GetPublicKeys returns all of this LocalUser's public encryption keys.
func (lu *LocalUser) GetPublicKeys() []keybase1.PublicKey {
	sibkeys := verifyingKeysToPublicKeys(lu.VerifyingKeys)
	subkeys := cryptPublicKeysToPublicKeys(lu.CryptPublicKeys)
	return append(sibkeys, subkeys...)
}

// DeepCopy returns a deep copy of this `LocalUser`.
func (lu LocalUser) DeepCopy() LocalUser {
	luCopy := lu

	luCopy.VerifyingKeys = make(
		[]kbfscrypto.VerifyingKey, len(lu.VerifyingKeys))
	copy(luCopy.VerifyingKeys, lu.VerifyingKeys)

	luCopy.CryptPublicKeys = make(
		[]kbfscrypto.CryptPublicKey, len(lu.CryptPublicKeys))
	copy(luCopy.CryptPublicKeys, lu.CryptPublicKeys)

	luCopy.KIDNames = make(map[keybase1.KID]string, len(lu.KIDNames))
	for k, v := range lu.KIDNames {
		luCopy.KIDNames[k] = v
	}

	luCopy.RevokedVerifyingKeys = make(
		map[kbfscrypto.VerifyingKey]RevokedKeyInfo,
		len(lu.RevokedVerifyingKeys))
	for k, v := range lu.RevokedVerifyingKeys {
		luCopy.RevokedVerifyingKeys[k] = v
	}

	luCopy.RevokedCryptPublicKeys = make(
		map[kbfscrypto.CryptPublicKey]RevokedKeyInfo,
		len(lu.RevokedCryptPublicKeys))
	for k, v := range lu.RevokedCryptPublicKeys {
		luCopy.RevokedCryptPublicKeys[k] = v
	}

	luCopy.Asserts = make([]string, len(lu.Asserts))
	copy(luCopy.Asserts, lu.Asserts)
	luCopy.UnverifiedKeys = make([]keybase1.PublicKey, len(lu.UnverifiedKeys))
	copy(luCopy.UnverifiedKeys, lu.UnverifiedKeys)

	return luCopy
}

func makeLocalTeams(
	teams []kbname.NormalizedUsername, startingIndex int, ty tlf.Type) (
	localTeams []TeamInfo) {
	localTeams = make([]TeamInfo, len(teams))
	for index := 0; index < len(teams); index++ {
		i := index + startingIndex
		cryptKey := MakeLocalTLFCryptKeyOrBust(
			tlf.SingleTeam.String()+"/"+string(teams[index]),
			kbfsmd.FirstValidKeyGen)
		localTeams[index] = TeamInfo{
			Name: teams[index],
			TID:  keybase1.MakeTestTeamID(uint32(i+1), ty == tlf.Public),
			CryptKeys: map[kbfsmd.KeyGen]kbfscrypto.TLFCryptKey{
				kbfsmd.FirstValidKeyGen: cryptKey,
			},
			LatestKeyGen: kbfsmd.FirstValidKeyGen,
		}
		// If this is a subteam, set the root ID.
		if strings.Contains(string(teams[index]), ".") {
			parts := strings.SplitN(string(teams[index]), ".", 2)
			for j := 0; j < index; j++ {
				if parts[0] == string(localTeams[j].Name) {
					localTeams[index].RootID = localTeams[j].TID
					break
				}
			}
		}
	}
	return localTeams
}

// MakeLocalTeams is a helper function to generate a list of local
// teams suitable to use with KeybaseDaemonLocal.  Any subteams must come
// after their root team names in the `teams` slice.
func MakeLocalTeams(teams []kbname.NormalizedUsername) []TeamInfo {
	return makeLocalTeams(teams, 0, tlf.Private)
}

// Helper functions to get a various keys for a local user. Each
// function will return the same key will always be returned for a
// given user.

// MakeLocalUserSigningKeyOrBust returns a unique signing key for this user.
func MakeLocalUserSigningKeyOrBust(
	name kbname.NormalizedUsername) kbfscrypto.SigningKey {
	return kbfscrypto.MakeFakeSigningKeyOrBust(
		string(name) + " signing key")
}

// MakeLocalUserCryptPublicKeyOrBust returns the public key
// corresponding to the crypt private key for this user.
func MakeLocalUserCryptPublicKeyOrBust(
	name kbname.NormalizedUsername) kbfscrypto.CryptPublicKey {
	return MakeLocalUserCryptPrivateKeyOrBust(name).GetPublicKey()
}

// MakeLocalUserVerifyingKeyOrBust makes a new verifying key
// corresponding to the signing key for this user.
func MakeLocalUserVerifyingKeyOrBust(
	name kbname.NormalizedUsername) kbfscrypto.VerifyingKey {
	return MakeLocalUserSigningKeyOrBust(name).GetVerifyingKey()
}

// MakeLocalUserCryptPrivateKeyOrBust returns a unique private
// encryption key for this user.
func MakeLocalUserCryptPrivateKeyOrBust(
	name kbname.NormalizedUsername) kbfscrypto.CryptPrivateKey {
	return kbfscrypto.MakeFakeCryptPrivateKeyOrBust(
		string(name) + " crypt key")
}

// MakeLocalTLFCryptKeyOrBust returns a unique private symmetric key
// for a TLF.
func MakeLocalTLFCryptKeyOrBust(
	name string, keyGen kbfsmd.KeyGen) kbfscrypto.TLFCryptKey {
	// Put the key gen first to make it more likely to fit into the
	// 32-character "random" seed.
	return kbfscrypto.MakeFakeTLFCryptKeyOrBust(
		name + " " + string(keyGen) + " crypt key ")
}

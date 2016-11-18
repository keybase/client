package libkb

// UPAK = "User Plus All Keys"

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// BaseProofSet creates a basic proof set for a user with their
// keybase and uid proofs and any pgp fingerpring proofs.
func BaseProofSet(u *keybase1.UserPlusAllKeys) *ProofSet {
	proofs := []Proof{
		{Key: "keybase", Value: u.GetName()},
		{Key: "uid", Value: u.GetUID().String()},
	}
	for _, key := range u.PGPKeys {
		proofs = append(proofs, Proof{Key: PGPAssertionKey, Value: key.PGPFingerprint})
	}
	return NewProofSet(proofs)
}

// checkKIDPGP checks that the user has the given PGP KID valid *now*. Note that it doesn't
// check for revoked PGP keys, and it also does not check key expiration.
func checkKIDPGP(u *keybase1.UserPlusAllKeys, kid keybase1.KID) (found bool) {
	for _, key := range u.PGPKeys {
		if key.KID.Equal(kid) {
			return true
		}
	}
	return false
}

func checkKIDKeybase(u *keybase1.UserPlusAllKeys, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime) {
	for _, key := range u.Base.DeviceKeys {
		if key.KID.Equal(kid) {
			return true, nil
		}
	}
	for _, key := range u.Base.RevokedDeviceKeys {
		if key.Key.KID.Equal(kid) {
			return true, &key.Time
		}
	}
	return false, nil
}

func CheckKID(u *keybase1.UserPlusAllKeys, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime) {
	if IsPGPAlgo(AlgoType(kid.GetKeyType())) {
		found = checkKIDPGP(u, kid)
		return found, nil
	}
	return checkKIDKeybase(u, kid)
}

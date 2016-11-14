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

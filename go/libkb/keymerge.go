// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto"

	"github.com/keybase/go-crypto/openpgp/packet"
)

func combineSignatures(toSignatures []*packet.Signature, fromSignatures []*packet.Signature) (ret []*packet.Signature) {
	ret = toSignatures
	existingSignatures := make(map[crypto.Hash]bool)
	for _, signature := range toSignatures {
		existingSignatures[signature.Hash] = true
	}
	for _, signature := range fromSignatures {
		if _, haveSignature := existingSignatures[signature.Hash]; haveSignature {
			continue
		}
		ret = append(ret, signature)
	}
	return
}

// MergeKey adds the identities, revocations, and subkeys of another PGPKeyBundle to this key
func (to *PGPKeyBundle) MergeKey(from *PGPKeyBundle) {

	// First, merge identities, adding any signatures found in matching identities
	for name, fromIdentity := range from.Identities {
		if toIdentity, ok := to.Identities[name]; ok {
			to.Identities[name].Signatures = combineSignatures(toIdentity.Signatures, fromIdentity.Signatures)

			// There's a primary self-signature that we use. Always take the later
			// of the two.
			ssTo := to.Identities[name].SelfSignature
			ssFrom := fromIdentity.SelfSignature
			if ssFrom.CreationTime.After(ssTo.CreationTime) {
				to.Identities[name].SelfSignature = ssFrom
			}

		} else {
			to.Identities[fromIdentity.Name] = fromIdentity
		}
	}

	// Then, merge revocations
	to.Revocations = combineSignatures(to.Revocations, from.Revocations)

	// Finally, merge subkeys
	existingSubkeys := make(map[[20]byte]int)
	for i, subkey := range to.Subkeys {
		existingSubkeys[subkey.PublicKey.Fingerprint] = i
	}
	for _, subkey := range from.Subkeys {
		if i, ok := existingSubkeys[subkey.PublicKey.Fingerprint]; ok {
			if subkey.Sig.CreationTime.After(to.Subkeys[i].Sig.CreationTime) {
				to.Subkeys[i].Sig = subkey.Sig
				if subkey.Revocation != nil {
					to.Subkeys[i].Revocation = subkey.Revocation
				}
			}
		} else {
			to.Subkeys = append(to.Subkeys, subkey)
		}
	}
}

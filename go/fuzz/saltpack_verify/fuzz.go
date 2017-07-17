// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build gofuzz

package saltpack

import (
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/keybase/go-crypto/ed25519"
	"github.com/keybase/saltpack"
)

type sigPubKey struct {
	key [ed25519.PublicKeySize]byte
}

func newSigPubKey(key [ed25519.PublicKeySize]byte) *sigPubKey {
	return &sigPubKey{key: key}
}

func (s *sigPubKey) ToKID() []byte {
	return s.key[:]
}

func (s *sigPubKey) Verify(message []byte, signature []byte) error {
	if len(signature) != ed25519.SignatureSize {
		return fmt.Errorf("signature size: %d, expected %d", len(signature), ed25519.SignatureSize)
	}
	var fixed [ed25519.SignatureSize]byte
	copy(fixed[:], signature)

	if !ed25519.Verify(s.key[:], message, &fixed) {
		return errors.New("bad signature")
	}
	return nil
}

type keyring struct {
	*sigPubKey
}

func (k keyring) LookupSigningPublicKey(kid []byte) saltpack.SigningPublicKey {
	// for the sake of fuzzing, just return this key all the time
	return k
}

var key *sigPubKey

// all the signed_X files in corpus were signed with this key:
const kid = "24cab0e45c53a63d22ee5a24d37c108c5dc2cb3e14a294db552864d3a2734491"

func init() {
	b, err := hex.DecodeString(kid)
	if err != nil {
		panic(err)
	}
	var k [ed25519.PublicKeySize]byte
	copy(k[:], b)
	key = newSigPubKey(k)
}

func Fuzz(data []byte) int {
	skey, _, err := saltpack.Verify(data, keyring{key})
	if err != nil {
		// errors are ok
		return 0
	}
	// if no error, check that the returned key matches
	if !saltpack.KIDEqual(key, skey) {
		panic("verifier key doesn't match signer key")
	}

	return 1
}

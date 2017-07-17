// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build gofuzz

package saltpack

import (
	"bytes"
	"crypto/rand"
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

	if !ed25519.Verify(s.key[:], message, signature) {
		return errors.New("bad signature")
	}
	return nil
}

type sigPrivKey struct {
	public  *sigPubKey
	private [ed25519.PrivateKeySize]byte
}

func newSigPrivKey() (*sigPrivKey, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}

	var pubArray [ed25519.PublicKeySize]byte
	copy(pubArray[:], pub)
	var privArray [ed25519.PrivateKeySize]byte
	copy(privArray[:], priv)

	k := &sigPrivKey{
		public:  newSigPubKey(pubArray),
		private: privArray,
	}
	return k, nil
}

func (s *sigPrivKey) Sign(message []byte) ([]byte, error) {
	return ed25519.Sign(s.private[:], message), nil
}

func (s *sigPrivKey) PublicKey() saltpack.SigningPublicKey {
	return s.public
}

type keyring struct {
	*sigPrivKey
}

func (k keyring) LookupSigningPublicKey(kid []byte) saltpack.SigningPublicKey {
	pk := k.PublicKey()
	if !bytes.Equal(pk.ToKID(), kid) {
		return nil
	}
	return pk
}

var key sigPrivKey

// need to use the same key to reproduce any crashes
const pub = "6c5c265954680fc35f5a6517f5edea8ad59bde223fbf8436885249e5d8322bd7"
const priv = "4611bd66f2f5c2da2446150e29d4dd92209901e71ef0704057f5d40b8e665cfe6c5c265954680fc35f5a6517f5edea8ad59bde223fbf8436885249e5d8322bd7"

func init() {
	bp, err := hex.DecodeString(pub)
	if err != nil {
		panic(err)
	}
	var pubk sigPubKey
	copy(pubk.key[:], bp)
	key.public = &pubk

	bv, err := hex.DecodeString(priv)
	if err != nil {
		panic(err)
	}
	copy(key.private[:], bv)
}

func Fuzz(data []byte) int {
	smsg, err := saltpack.Sign(data, &key)
	if err != nil {
		panic(err)
	}
	skey, vmsg, err := saltpack.Verify(smsg, keyring{&key})
	if err != nil {
		panic(err)
	}
	if !bytes.Equal(vmsg, data) {
		panic("message mismatch")
	}
	if !saltpack.KIDEqual(key.PublicKey(), skey) {
		panic("verifier key doesn't match signer key")
	}

	return 0
}

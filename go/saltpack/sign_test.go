// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"crypto/rand"
	"fmt"
	"testing"

	"github.com/agl/ed25519"
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

func (s *sigPubKey) Verify(message []byte, signature []byte) (bool, error) {
	if len(signature) != ed25519.SignatureSize {
		return false, fmt.Errorf("signature size: %d, expected %d", len(signature), ed25519.SignatureSize)
	}
	var fixed [ed25519.SignatureSize]byte
	copy(fixed[:], signature)

	return ed25519.Verify(&s.key, message, &fixed), nil
}

type sigPrivKey struct {
	public  *sigPubKey
	private [ed25519.PrivateKeySize]byte
}

func newSigPrivKey(t *testing.T) *sigPrivKey {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	k := &sigPrivKey{
		public:  newSigPubKey(*pub),
		private: *priv,
	}
	kr.insertSigningKey(k)
	return k
}

func (s *sigPrivKey) Sign(message []byte) ([]byte, error) {
	sig := ed25519.Sign(&s.private, message)
	return sig[:], nil
}

func (s *sigPrivKey) PublicKey() SigningPublicKey {
	return s.public
}

func TestSign(t *testing.T) {
	msg := randomMsg(t, 128)
	key := newSigPrivKey(t)
	out, err := Sign(msg, key, MessageTypeAttachedSignature)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) == 0 {
		t.Fatal("Sign returned no error and no output")
	}
}

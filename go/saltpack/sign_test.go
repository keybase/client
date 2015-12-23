// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"io"
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

func (s *sigPubKey) Verify(message []byte, signature []byte) error {
	if len(signature) != ed25519.SignatureSize {
		return fmt.Errorf("signature size: %d, expected %d", len(signature), ed25519.SignatureSize)
	}
	var fixed [ed25519.SignatureSize]byte
	copy(fixed[:], signature)

	if !ed25519.Verify(&s.key, message, &fixed) {
		return ErrBadSignature
	}
	return nil
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
	out, err := Sign(msg, key)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) == 0 {
		t.Fatal("Sign returned no error and no output")
	}
}

func testSignAndVerify(t *testing.T, message []byte) {
	key := newSigPrivKey(t)
	smsg, err := Sign(message, key)
	if err != nil {
		t.Fatal(err)
	}
	if len(smsg) == 0 {
		t.Fatal("Sign returned no error and no output")
	}
	skey, vmsg, err := Verify(smsg, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !KIDEqual(skey, key.PublicKey()) {
		t.Errorf("signer key %x, expected %x", skey.ToKID(), key.PublicKey().ToKID())
	}
	if !bytes.Equal(vmsg, message) {
		t.Errorf("verified msg '%x', expected '%x'", vmsg, message)
	}
}

func TestSignMessageSizes(t *testing.T) {
	sizes := []int{10, 128, 1024, 1100, 1024 * 10, 1024*10 + 64, 1024 * 100, 1024*100 + 99, 1024 * 1024 * 3}
	for _, size := range sizes {
		t.Logf("testing sign and verify message size = %d", size)
		testSignAndVerify(t, randomMsg(t, size))
	}
}

func TestSignTruncation(t *testing.T) {
	key := newSigPrivKey(t)
	smsg, err := Sign(randomMsg(t, 128), key)
	if err != nil {
		t.Fatal(err)
	}
	if len(smsg) == 0 {
		t.Fatal("Sign returned no error and no output")
	}
	trunced := smsg[:len(smsg)-51]
	skey, vmsg, err := Verify(trunced, kr)
	if skey != nil {
		t.Errorf("Verify returned a key for a truncated message")
	}
	if vmsg != nil {
		t.Errorf("Verify returned a message for a truncated message")
	}
	if err != io.ErrUnexpectedEOF {
		t.Errorf("error: %v, expected %v", err, io.ErrUnexpectedEOF)
	}

}

func TestSignDetached(t *testing.T) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)
	sig, err := SignDetached(msg, key)
	if err != nil {
		t.Fatal(err)
	}
	if len(sig) == 0 {
		t.Fatal("empty sig and no error from SignDetached")
	}

	skey, err := VerifyDetached(msg, sig, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !KIDEqual(skey, key.PublicKey()) {
		t.Errorf("signer key %x, expected %x", skey.ToKID(), key.PublicKey().ToKID())
	}
}

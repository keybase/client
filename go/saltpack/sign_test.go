// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"sync"
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

type sigErrKey struct{}

func (s *sigErrKey) Sign(message []byte) ([]byte, error) { return nil, errors.New("sign error") }
func (s *sigErrKey) PublicKey() SigningPublicKey         { return &sigPubKey{} }

type sigNilPubKey struct{}

func (s *sigNilPubKey) Sign(message []byte) ([]byte, error) { return nil, errors.New("sign error") }
func (s *sigNilPubKey) PublicKey() SigningPublicKey         { return nil }

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

func TestSignConcurrent(t *testing.T) {
	msg := randomMsg(t, 128)
	key := newSigPrivKey(t)
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			out, err := Sign(msg, key)
			if err != nil {
				t.Error(err)
			}
			if len(out) == 0 {
				t.Error("Sign returned no error and no output")
			}
			wg.Done()
		}()
	}
	wg.Wait()
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

func TestSignEmptyMessage(t *testing.T) {
	var msg []byte
	testSignAndVerify(t, msg)
}

func TestSignEmptyStream(t *testing.T) {
	key := newSigPrivKey(t)
	var buf bytes.Buffer
	s, err := NewSignStream(&buf, key)
	if err != nil {
		t.Fatal(err)
	}
	// just close the stream
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	smsg := buf.Bytes()
	if len(smsg) == 0 {
		t.Fatal("empty signed message")
	}

	skey, vmsg, err := Verify(smsg, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !KIDEqual(skey, key.PublicKey()) {
		t.Errorf("signer key %x, expected %x", skey.ToKID(), key.PublicKey().ToKID())
	}
	if len(vmsg) != 0 {
		t.Errorf("verified msg '%x', expected empty", vmsg)
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

func TestSignSkipBlock(t *testing.T) {
	key := newSigPrivKey(t)
	var opts testSignOptions
	numBlocks := 10
	opts.skipBlock = func(n PacketSeqno) bool {
		return int(n) == numBlocks-1
	}
	smsg, err := testTweakSign(randomMsg(t, numBlocks*1024*1024), key, opts)
	if err != nil {
		t.Fatal(err)
	}
	skey, vmsg, err := Verify(smsg, kr)
	if skey != nil {
		t.Errorf("Verify returned a key for a message with a missing block")
	}
	if vmsg != nil {
		t.Errorf("Verify returned a message for a message with missing block")
	}
	if err != io.ErrUnexpectedEOF {
		t.Errorf("error: %v, expected %v", err, io.ErrUnexpectedEOF)
	}
}

func TestSignSkipFooter(t *testing.T) {
	key := newSigPrivKey(t)
	opts := testSignOptions{skipFooter: true}
	smsg, err := testTweakSign(randomMsg(t, 128), key, opts)
	if err != nil {
		t.Fatal(err)
	}
	skey, vmsg, err := Verify(smsg, kr)
	if skey != nil {
		t.Errorf("Verify returned a key for a message without a footer")
	}
	if vmsg != nil {
		t.Errorf("Verify returned a message for a signed message without a footer")
	}
	if err != io.ErrUnexpectedEOF {
		t.Errorf("error: %v, expected %v", err, io.ErrUnexpectedEOF)
	}
}

func TestSignSwapBlock(t *testing.T) {
	key := newSigPrivKey(t)
	opts := testSignOptions{swapBlock: true}
	smsg, err := testTweakSign(randomMsg(t, 5*1024*1024), key, opts)
	if err != nil {
		t.Fatal(err)
	}
	skey, vmsg, err := Verify(smsg, kr)
	if skey != nil {
		t.Errorf("Verify returned a key for a message without a footer")
	}
	if vmsg != nil {
		t.Errorf("Verify returned a message for a signed message without a footer")
	}
	if err != ErrBadSignature {
		t.Errorf("error: %v, expected %v", err, ErrBadSignature)
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

func TestSignDetachedVerifyAttached(t *testing.T) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)
	sig, err := SignDetached(msg, key)
	if err != nil {
		t.Fatal(err)
	}
	if len(sig) == 0 {
		t.Fatal("empty sig and no error from SignDetached")
	}

	// try verifying detached signature using Verify instead of VerifyDetached
	skey, vmsg, err := Verify(sig, kr)
	if err == nil {
		t.Fatal("Verify succeeded, expected it to fail")
	}
	if _, ok := err.(ErrWrongMessageType); !ok {
		t.Errorf("error %T, expected ErrWrongMessageType", err)
	}
	if skey != nil {
		t.Errorf("skey: %x, expected nil", skey)
	}
	if vmsg != nil {
		t.Errorf("vmsg: %x, expected nil", vmsg)
	}
}

func TestSignAttachedVerifyDetached(t *testing.T) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)
	smsg, err := Sign(msg, key)
	if err != nil {
		t.Fatal(err)
	}

	skey, err := VerifyDetached(msg, smsg, kr)
	if err == nil {
		t.Fatal("VerifyDetached succeeded, expected it to fail")
	}
	if _, ok := err.(ErrWrongMessageType); !ok {
		t.Errorf("error %T, expected ErrWrongMessageType", err)
	}
	if skey != nil {
		t.Errorf("skey: %x, expected nil", skey)
	}
}

func TestSignBadKey(t *testing.T) {
	key := newSigPrivKey(t)
	rand.Read(key.private[:])
	msg := randomMsg(t, 128)
	smsg, err := Sign(msg, key)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Verify(smsg, kr)
	if err != ErrBadSignature {
		t.Errorf("error: %v, expected ErrBadSignature", err)
	}

	sig, err := SignDetached(msg, key)
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyDetached(msg, sig, kr)
	if err != ErrBadSignature {
		t.Errorf("error: %v, expected ErrBadSignature", err)
	}
}

func TestSignNilKey(t *testing.T) {
	msg := randomMsg(t, 128)
	_, err := Sign(msg, nil)
	if err == nil {
		t.Fatal("Sign with nil key didn't fail")
	}
	if _, ok := err.(ErrInvalidParameter); !ok {
		t.Errorf("error %T, expected ErrInvalidParameter", err)
	}

	_, err = SignDetached(msg, nil)
	if err == nil {
		t.Fatal("SignDetached with nil key didn't fail")
	}
	if _, ok := err.(ErrInvalidParameter); !ok {
		t.Errorf("error %T, expected ErrInvalidParameter", err)
	}
}

func TestSignBadRandReader(t *testing.T) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)

	r := rand.Reader
	defer func() {
		rand.Reader = r
	}()
	rand.Reader = errReader{}

	_, err := Sign(msg, key)
	if err == nil {
		t.Errorf("Sign with errReader for rand.Reader didn't fail")
	}
}

// test signing with a key that always returns errors for Sign().
func TestSignErrSigner(t *testing.T) {
	key := new(sigErrKey)
	msg := randomMsg(t, 128)
	_, err := Sign(msg, key)
	if err == nil {
		t.Errorf("Sign with err key didn't fail")
	}

	_, err = SignDetached(msg, key)
	if err == nil {
		t.Errorf("SignDetached with err key didn't fail")
	}
}

func TestSignNilPubKey(t *testing.T) {
	key := new(sigNilPubKey)
	msg := randomMsg(t, 128)
	_, err := Sign(msg, key)
	if err == nil {
		t.Errorf("Sign with nil pub key didn't fail")
	}

	_, err = SignDetached(msg, key)
	if err == nil {
		t.Errorf("SignDetached with nil pub key didn't fail")
	}
}

func TestSignCorruptHeader(t *testing.T) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)

	var opts testSignOptions

	// first try with no corruption
	smsg, err := testTweakSign(msg, key, opts)
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
	if !bytes.Equal(vmsg, msg) {
		t.Errorf("verified msg '%x', expected '%x'", vmsg, msg)
	}

	// change the version
	opts.corruptHeader = func(sh *SignatureHeader) {
		sh.Version = Version{Major: SaltpackCurrentVersion.Major + 1, Minor: 0}
	}
	smsg, err = testTweakSign(msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Verify(smsg, kr)
	if _, ok := err.(ErrBadVersion); !ok {
		t.Errorf("error: %v (%T), expected ErrBadVersion", err, err)
	}

	// change the message type from attached to detached
	opts.corruptHeader = func(sh *SignatureHeader) {
		sh.Type = MessageTypeDetachedSignature
	}
	smsg, err = testTweakSign(msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Verify(smsg, kr)
	if _, ok := err.(ErrWrongMessageType); !ok {
		t.Errorf("error: %v (%T), expected ErrWrongMessageType", err, err)
	}

	// change the message type to encryption
	opts.corruptHeader = func(sh *SignatureHeader) {
		sh.Type = MessageTypeEncryption
	}
	smsg, err = testTweakSign(msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Verify(smsg, kr)
	if _, ok := err.(ErrWrongMessageType); !ok {
		t.Errorf("error: %v (%T), expected ErrWrongMessageType", err, err)
	}

	// make the header the wrong type of object
	opts = testSignOptions{
		corruptHeaderBytes: func(bytes *[]byte) {
			badBytes, _ := encodeToBytes(42)
			*bytes = badBytes
		},
	}
	smsg, err = testTweakSign(msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Verify(smsg, kr)
	if err == nil {
		t.Fatal(err)
	}

	// truncate the message in the middle of the header
	smsg, err = testTweakSign(msg, key, testSignOptions{})
	if err != nil {
		t.Fatal(err)
	}
	truncated := smsg[0:10]
	_, _, err = Verify(truncated, kr)
	if err == nil {
		t.Fatal(err)
	}
}

func TestSignDetachedCorruptHeader(t *testing.T) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)

	var opts testSignOptions

	// first try with no corruption
	sig, err := testTweakSignDetached(msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	skey, err := VerifyDetached(msg, sig, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !KIDEqual(skey, key.PublicKey()) {
		t.Errorf("signer key %x, expected %x", skey.ToKID(), key.PublicKey().ToKID())
	}

	// change the message type to attached
	opts.corruptHeader = func(sh *SignatureHeader) {
		sh.Type = MessageTypeAttachedSignature
	}
	sig, err = testTweakSignDetached(msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyDetached(msg, sig, kr)
	if _, ok := err.(ErrWrongMessageType); !ok {
		t.Errorf("error: %v (%T), expected ErrWrongMessageType", err, err)
	}

	// change the message type to encryption
	opts.corruptHeader = func(sh *SignatureHeader) {
		sh.Type = MessageTypeEncryption
	}
	sig, err = testTweakSignDetached(msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyDetached(msg, sig, kr)
	if _, ok := err.(ErrWrongMessageType); !ok {
		t.Errorf("error: %v (%T), expected ErrWrongMessageType", err, err)
	}
}

func TestSignDetachedTruncated(t *testing.T) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)

	sig, err := testTweakSignDetached(msg, key, testSignOptions{})
	if err != nil {
		t.Fatal(err)
	}

	// truncate the sig by one byte
	shortSig := sig[0 : len(sig)-1]

	_, err = VerifyDetached(msg, shortSig, kr)
	if err == nil {
		t.Fatal("expected EOF error from truncated sig")
	}
}

type errReader struct{}

func (e errReader) Read(p []byte) (int, error) { return 0, errors.New("read error") }

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

	"golang.org/x/crypto/ed25519"
)

type sigPubKey struct {
	key []byte
}

func newSigPubKey(key []byte) *sigPubKey {
	return &sigPubKey{key: key}
}

func (s *sigPubKey) ToKID() []byte {
	return s.key
}

func (s *sigPubKey) Verify(message []byte, signature []byte) error {
	if len(signature) != ed25519.SignatureSize {
		return fmt.Errorf("signature size: %d, expected %d", len(signature), ed25519.SignatureSize)
	}

	if !ed25519.Verify(s.key, message, signature) {
		return ErrBadSignature
	}
	return nil
}

type sigPrivKey struct {
	public  *sigPubKey
	private []byte
}

func newSigPrivKey(t *testing.T) *sigPrivKey {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	k := &sigPrivKey{
		public:  newSigPubKey(pub),
		private: priv,
	}
	kr.insertSigningKey(k)
	return k
}

func (s *sigPrivKey) Sign(message []byte) ([]byte, error) {
	sig := ed25519.Sign(s.private, message)
	return sig[:], nil
}

func (s *sigPrivKey) GetPublicKey() SigningPublicKey {
	return s.public
}

type sigErrKey struct{}

func (s *sigErrKey) Sign(message []byte) ([]byte, error) { return nil, errors.New("sign error") }
func (s *sigErrKey) GetPublicKey() SigningPublicKey      { return &sigPubKey{} }

type sigNilPubKey struct{}

func (s *sigNilPubKey) Sign(message []byte) ([]byte, error) { return nil, errors.New("sign error") }
func (s *sigNilPubKey) GetPublicKey() SigningPublicKey      { return nil }

func testSign(t *testing.T, version Version) {
	msg := randomMsg(t, 128)
	key := newSigPrivKey(t)
	out, err := Sign(version, msg, key)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) == 0 {
		t.Fatal("Sign returned no error and no output")
	}
}

func testSignConcurrent(t *testing.T, version Version) {
	msg := randomMsg(t, 128)
	key := newSigPrivKey(t)
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			out, err := Sign(version, msg, key)
			if err != nil {
				t.Error(err)
			}
			if len(out) == 0 {
				t.Error("Sign returned no error and no output")
			}
		}()
	}
	wg.Wait()
}

func testSignAndVerify(t *testing.T, version Version, message []byte) {
	key := newSigPrivKey(t)
	smsg, err := Sign(version, message, key)
	if err != nil {
		t.Fatal(err)
	}
	if len(smsg) == 0 {
		t.Fatal("Sign returned no error and no output")
	}
	skey, vmsg, err := Verify(SingleVersionValidator(version), smsg, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !PublicKeyEqual(skey, key.GetPublicKey()) {
		t.Errorf("signer key %x, expected %x", skey.ToKID(), key.GetPublicKey().ToKID())
	}
	if !bytes.Equal(vmsg, message) {
		t.Errorf("verified msg '%x', expected '%x'", vmsg, message)
	}
}

func testSignEmptyMessage(t *testing.T, version Version) {
	var msg []byte
	testSignAndVerify(t, version, msg)
}

func testSignEmptyStream(t *testing.T, version Version) {
	key := newSigPrivKey(t)
	var buf bytes.Buffer
	s, err := NewSignStream(version, &buf, key)
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

	skey, vmsg, err := Verify(SingleVersionValidator(version), smsg, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !PublicKeyEqual(skey, key.GetPublicKey()) {
		t.Errorf("signer key %x, expected %x", skey.ToKID(), key.GetPublicKey().ToKID())
	}
	if len(vmsg) != 0 {
		t.Errorf("verified msg '%x', expected empty", vmsg)
	}
}

func testSignMessageSizes(t *testing.T, version Version) {
	sizes := []int{10, 128, 1024, 1100, 1024 * 10, 1024*10 + 64, 1024 * 100, 1024*100 + 99, 1024 * 1024 * 3}
	for _, size := range sizes {
		t.Logf("testing sign and verify message size = %d", size)
		testSignAndVerify(t, version, randomMsg(t, size))
	}
}

func testSignTruncation(t *testing.T, version Version) {
	key := newSigPrivKey(t)
	smsg, err := Sign(version, randomMsg(t, 128), key)
	if err != nil {
		t.Fatal(err)
	}
	if len(smsg) == 0 {
		t.Fatal("Sign returned no error and no output")
	}
	trunced := smsg[:len(smsg)-51]
	skey, vmsg, err := Verify(SingleVersionValidator(version), trunced, kr)
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

func testSignSkipBlock(t *testing.T, version Version) {
	key := newSigPrivKey(t)
	var opts testSignOptions
	numBlocks := 10
	opts.skipBlock = func(n packetSeqno) bool {
		return int(n) == numBlocks-1
	}
	smsg, err := testTweakSign(version, randomMsg(t, numBlocks*1024*1024), key, opts)
	if err != nil {
		t.Fatal(err)
	}
	skey, vmsg, err := Verify(SingleVersionValidator(version), smsg, kr)
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

func testSignSkipFooter(t *testing.T, version Version) {
	key := newSigPrivKey(t)
	opts := testSignOptions{skipFooter: true}
	smsg, err := testTweakSign(version, randomMsg(t, 128), key, opts)
	if err != nil {
		t.Fatal(err)
	}
	skey, vmsg, err := Verify(SingleVersionValidator(version), smsg, kr)
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

func testSignSwapBlock(t *testing.T, version Version) {
	key := newSigPrivKey(t)
	opts := testSignOptions{swapBlock: true}
	smsg, err := testTweakSign(version, randomMsg(t, 5*1024*1024), key, opts)
	if err != nil {
		t.Fatal(err)
	}
	skey, vmsg, err := Verify(SingleVersionValidator(version), smsg, kr)
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

func testSignDetached(t *testing.T, version Version) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)
	sig, err := SignDetached(version, msg, key)
	if err != nil {
		t.Fatal(err)
	}
	if len(sig) == 0 {
		t.Fatal("empty sig and no error from SignDetached")
	}

	skey, err := VerifyDetached(SingleVersionValidator(version), msg, sig, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !PublicKeyEqual(skey, key.GetPublicKey()) {
		t.Errorf("signer key %x, expected %x", skey.ToKID(), key.GetPublicKey().ToKID())
	}
}

func testSignDetachedVerifyAttached(t *testing.T, version Version) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)
	sig, err := SignDetached(version, msg, key)
	if err != nil {
		t.Fatal(err)
	}
	if len(sig) == 0 {
		t.Fatal("empty sig and no error from SignDetached")
	}

	// try verifying detached signature using Verify instead of VerifyDetached
	skey, vmsg, err := Verify(SingleVersionValidator(version), sig, kr)
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

func testSignAttachedVerifyDetached(t *testing.T, version Version) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)
	smsg, err := Sign(version, msg, key)
	if err != nil {
		t.Fatal(err)
	}

	skey, err := VerifyDetached(SingleVersionValidator(version), msg, smsg, kr)
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

func testSignBadKey(t *testing.T, version Version) {
	key := newSigPrivKey(t)
	rand.Read(key.private[:])
	msg := randomMsg(t, 128)
	smsg, err := Sign(version, msg, key)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Verify(SingleVersionValidator(version), smsg, kr)
	if err != ErrBadSignature {
		t.Errorf("error: %v, expected ErrBadSignature", err)
	}

	sig, err := SignDetached(version, msg, key)
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyDetached(SingleVersionValidator(version), msg, sig, kr)
	if err != ErrBadSignature {
		t.Errorf("error: %v, expected ErrBadSignature", err)
	}
}

func testSignNilKey(t *testing.T, version Version) {
	msg := randomMsg(t, 128)
	_, err := Sign(version, msg, nil)
	if err == nil {
		t.Fatal("Sign with nil key didn't fail")
	}
	if _, ok := err.(ErrInvalidParameter); !ok {
		t.Errorf("error %T, expected ErrInvalidParameter", err)
	}

	_, err = SignDetached(version, msg, nil)
	if err == nil {
		t.Fatal("SignDetached with nil key didn't fail")
	}
	if _, ok := err.(ErrInvalidParameter); !ok {
		t.Errorf("error %T, expected ErrInvalidParameter", err)
	}
}

type errReader struct{}

func (e errReader) Read(p []byte) (int, error) { return 0, errors.New("read error") }

func testSignBadRandReader(t *testing.T, version Version) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)

	r := rand.Reader
	defer func() {
		rand.Reader = r
	}()
	rand.Reader = errReader{}

	_, err := Sign(version, msg, key)
	if err == nil {
		t.Errorf("Sign with errReader for rand.Reader didn't fail")
	}
}

// test signing with a key that always returns errors for Sign(version, ).
func testSignErrSigner(t *testing.T, version Version) {
	key := new(sigErrKey)
	msg := randomMsg(t, 128)
	_, err := Sign(version, msg, key)
	if err == nil {
		t.Errorf("Sign with err key didn't fail")
	}

	_, err = SignDetached(version, msg, key)
	if err == nil {
		t.Errorf("SignDetached with err key didn't fail")
	}
}

func testSignNilPubKey(t *testing.T, version Version) {
	key := new(sigNilPubKey)
	msg := randomMsg(t, 128)
	_, err := Sign(version, msg, key)
	if err == nil {
		t.Errorf("Sign with nil pub key didn't fail")
	}

	_, err = SignDetached(version, msg, key)
	if err == nil {
		t.Errorf("SignDetached with nil pub key didn't fail")
	}
}

func testSignCorruptHeader(t *testing.T, version Version) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)

	badVersion := version
	badVersion.Major++

	var opts testSignOptions

	// first try with no corruption
	smsg, err := testTweakSign(version, msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	if len(smsg) == 0 {
		t.Fatal("Sign returned no error and no output")
	}
	skey, vmsg, err := Verify(SingleVersionValidator(version), smsg, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !PublicKeyEqual(skey, key.GetPublicKey()) {
		t.Errorf("signer key %x, expected %x", skey.ToKID(), key.GetPublicKey().ToKID())
	}
	if !bytes.Equal(vmsg, msg) {
		t.Errorf("verified msg '%x', expected '%x'", vmsg, msg)
	}

	// change the version
	opts.corruptHeader = func(sh *SignatureHeader) {
		sh.Version = badVersion
	}
	smsg, err = testTweakSign(version, msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Verify(SingleVersionValidator(version), smsg, kr)
	if ebv, ok := err.(ErrBadVersion); !ok {
		t.Fatalf("Got wrong error; wanted 'Bad Version' but got %v", err)
	} else if ebv.received != badVersion {
		t.Fatalf("got wrong version # in error message: %v", ebv.received)
	}

	// change the message type from attached to detached
	opts.corruptHeader = func(sh *SignatureHeader) {
		sh.Type = MessageTypeDetachedSignature
	}
	smsg, err = testTweakSign(version, msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Verify(SingleVersionValidator(version), smsg, kr)
	if _, ok := err.(ErrWrongMessageType); !ok {
		t.Errorf("error: %v (%T), expected ErrWrongMessageType", err, err)
	}

	// change the message type to encryption
	opts.corruptHeader = func(sh *SignatureHeader) {
		sh.Type = MessageTypeEncryption
	}
	smsg, err = testTweakSign(version, msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Verify(SingleVersionValidator(version), smsg, kr)
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
	smsg, err = testTweakSign(version, msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = Verify(SingleVersionValidator(version), smsg, kr)
	if err == nil {
		t.Fatal(err)
	}

	// truncate the message in the middle of the header
	smsg, err = testTweakSign(version, msg, key, testSignOptions{})
	if err != nil {
		t.Fatal(err)
	}
	truncated := smsg[0:10]
	_, _, err = Verify(SingleVersionValidator(version), truncated, kr)
	if err == nil {
		t.Fatal(err)
	}
}

func testSignDetachedCorruptHeader(t *testing.T, version Version) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)

	var opts testSignOptions

	// first try with no corruption
	sig, err := testTweakSignDetached(version, msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	skey, err := VerifyDetached(SingleVersionValidator(version), msg, sig, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !PublicKeyEqual(skey, key.GetPublicKey()) {
		t.Errorf("signer key %x, expected %x", skey.ToKID(), key.GetPublicKey().ToKID())
	}

	// change the message type to attached
	opts.corruptHeader = func(sh *SignatureHeader) {
		sh.Type = MessageTypeAttachedSignature
	}
	sig, err = testTweakSignDetached(version, msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyDetached(SingleVersionValidator(version), msg, sig, kr)
	if _, ok := err.(ErrWrongMessageType); !ok {
		t.Errorf("error: %v (%T), expected ErrWrongMessageType", err, err)
	}

	// change the message type to encryption
	opts.corruptHeader = func(sh *SignatureHeader) {
		sh.Type = MessageTypeEncryption
	}
	sig, err = testTweakSignDetached(version, msg, key, opts)
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyDetached(SingleVersionValidator(version), msg, sig, kr)
	if _, ok := err.(ErrWrongMessageType); !ok {
		t.Errorf("error: %v (%T), expected ErrWrongMessageType", err, err)
	}
}

func TestSignSinglePacketV1(t *testing.T) {
	message := make([]byte, signatureBlockSize)
	key := newSigPrivKey(t)
	smsg, err := Sign(Version1(), message, key)
	if err != nil {
		t.Fatal(err)
	}

	mps := newMsgpackStream(bytes.NewReader(smsg))

	var headerBytes []byte
	_, err = mps.Read(&headerBytes)
	if err != nil {
		t.Fatal(err)
	}

	var block signatureBlockV1

	// Payload packet.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	// Empty footer payload packet.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	// Nothing else.
	_, err = mps.Read(&block)
	if err != io.EOF {
		t.Fatalf("err=%v != io.EOF", err)
	}
}

func TestSignSinglePacketV2(t *testing.T) {
	message := make([]byte, signatureBlockSize)
	key := newSigPrivKey(t)
	smsg, err := Sign(Version2(), message, key)
	if err != nil {
		t.Fatal(err)
	}

	mps := newMsgpackStream(bytes.NewReader(smsg))

	var headerBytes []byte
	_, err = mps.Read(&headerBytes)
	if err != nil {
		t.Fatal(err)
	}

	var block signatureBlockV2

	// Payload packet.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	if !block.IsFinal {
		t.Fatal("block.IsFinal unexpectedly not set")
	}

	// Nothing else.
	_, err = mps.Read(&block)
	if err != io.EOF {
		t.Fatalf("err=%v != io.EOF", err)
	}
}

func TestSignSubsequenceV1(t *testing.T) {
	message := make([]byte, 2*signatureBlockSize)
	key := newSigPrivKey(t)
	smsg, err := Sign(Version1(), message, key)
	if err != nil {
		t.Fatal(err)
	}

	mps := newMsgpackStream(bytes.NewReader(smsg))

	// These truncated messages will have the first payload
	// packet, the second payload packet, and neither payload
	// packet, respectively.
	truncatedSMsg1 := bytes.NewBuffer(nil)
	truncatedSMsg2 := bytes.NewBuffer(nil)
	truncatedSMsg3 := bytes.NewBuffer(nil)
	encoder1 := newEncoder(truncatedSMsg1)
	encoder2 := newEncoder(truncatedSMsg2)
	encoder3 := newEncoder(truncatedSMsg3)

	encode := func(e encoder, i interface{}) {
		err = e.Encode(i)
		if err != nil {
			t.Fatal(err)
		}
	}

	var headerBytes []byte
	_, err = mps.Read(&headerBytes)
	if err != nil {
		t.Fatal(err)
	}

	encode(encoder1, headerBytes)
	encode(encoder2, headerBytes)
	encode(encoder3, headerBytes)

	var block signatureBlockV1

	// Payload packet 1.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	encode(encoder1, block)

	// Payload packet 2.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	encode(encoder2, block)

	// Empty footer payload packet.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	encode(encoder1, block)
	encode(encoder2, block)
	encode(encoder3, block)

	for i, truncatedSMsg := range []*bytes.Buffer{truncatedSMsg1, truncatedSMsg2, truncatedSMsg3} {
		_, _, err = Verify(SingleVersionValidator(Version1()), truncatedSMsg.Bytes(), kr)
		if err != ErrBadSignature {
			t.Errorf("err=%v != ErrBadSignature for truncatedSMsg%d", err, i+1)
		}
	}
}

func TestSignSubsequenceV2(t *testing.T) {
	message := make([]byte, 2*signatureBlockSize)
	key := newSigPrivKey(t)
	smsg, err := Sign(Version2(), message, key)
	if err != nil {
		t.Fatal(err)
	}

	mps := newMsgpackStream(bytes.NewReader(smsg))

	// These truncated messages will have the first payload
	// packet and the second payload packet, respectively.
	truncatedSMsg1 := bytes.NewBuffer(nil)
	truncatedSMsg2 := bytes.NewBuffer(nil)
	encoder1 := newEncoder(truncatedSMsg1)
	encoder2 := newEncoder(truncatedSMsg2)

	encode := func(e encoder, i interface{}) {
		err = e.Encode(i)
		if err != nil {
			t.Fatal(err)
		}
	}

	var headerBytes []byte
	_, err = mps.Read(&headerBytes)
	if err != nil {
		t.Fatal(err)
	}

	encode(encoder1, headerBytes)
	encode(encoder2, headerBytes)

	var block signatureBlockV2

	// Payload packet 1.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	block.IsFinal = true
	encode(encoder1, block)

	// Payload packet 2.
	_, err = mps.Read(&block)
	if err != nil {
		t.Fatal(err)
	}

	block.IsFinal = true
	encode(encoder2, block)

	for i, truncatedSMsg := range []*bytes.Buffer{truncatedSMsg1, truncatedSMsg2} {
		_, _, err = Verify(SingleVersionValidator(Version2()), truncatedSMsg.Bytes(), kr)
		if err != ErrBadSignature {
			t.Errorf("err=%v != ErrBadSignature for truncatedSMsg%d", err, i+1)
		}
	}
}

func testSignDetachedTruncated(t *testing.T, version Version) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)

	sig, err := testTweakSignDetached(version, msg, key, testSignOptions{})
	if err != nil {
		t.Fatal(err)
	}

	// truncate the sig by one byte
	shortSig := sig[0 : len(sig)-1]

	_, err = VerifyDetached(SingleVersionValidator(version), msg, shortSig, kr)
	if err == nil {
		t.Fatal("expected EOF error from truncated sig")
	}
}

func TestSign(t *testing.T) {
	tests := []func(*testing.T, Version){
		testSign,
		testSignConcurrent,
		testSignEmptyMessage,
		testSignEmptyStream,
		testSignMessageSizes,
		testSignTruncation,
		testSignSkipBlock,
		testSignSkipFooter,
		testSignSwapBlock,
		testSignDetached,
		testSignDetachedVerifyAttached,
		testSignAttachedVerifyDetached,
		testSignBadKey,
		testSignNilKey,
		testSignBadRandReader,
		testSignErrSigner,
		testSignNilPubKey,
		testSignCorruptHeader,
		testSignDetachedCorruptHeader,
		testSignDetachedTruncated,
	}
	runTestsOverVersions(t, "test", tests)
}

package libkbfs

import (
	"testing"

	"golang.org/x/crypto/nacl/box"

	"github.com/keybase/client/go/libkb"
)

// Test (very superficially) that MakeTemporaryBlockID() returns non-zero
// values that aren't equal.
func TestCryptoCommonRandomBlockID(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	b1, err := c.MakeTemporaryBlockID()
	if err != nil {
		t.Fatal(err)
	}

	if b1 == (BlockID{}) {
		t.Errorf("zero BlockID (b1)")
	}

	b2, err := c.MakeTemporaryBlockID()
	if err != nil {
		t.Fatal(err)
	}

	if b2 == (BlockID{}) {
		t.Errorf("zero BlockID (b2)")
	}

	if b1 == b2 {
		t.Errorf("b1 == b2")
	}
}

// Test (very superficially) that MakeRandomTLFKeys() returns non-zero
// values that aren't equal.
func TestCryptoCommonRandomTLFKeys(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	a1, a2, a3, a4, a5, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	b1, b2, b3, b4, b5, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	if a1 == (TLFPublicKey{}) {
		t.Errorf("zero TLFPublicKey (a1)")
	}

	if a2 == (TLFPrivateKey{}) {
		t.Errorf("zero TLFPrivateKey (a2)")
	}

	if a3 == (TLFEphemeralPublicKey{}) {
		t.Errorf("zero TLFEphemeralPublicKey (a3)")
	}

	if a4 == (TLFEphemeralPrivateKey{}) {
		t.Errorf("zero TLFEphemeralPrivateKey (a4)")
	}

	if a5 == (TLFCryptKey{}) {
		t.Errorf("zero TLFCryptKey (a5)")
	}

	if b1 == (TLFPublicKey{}) {
		t.Errorf("zero TLFPublicKey (1)")
	}

	if b2 == (TLFPrivateKey{}) {
		t.Errorf("zero TLFPrivateKey (b2)")
	}

	if b3 == (TLFEphemeralPublicKey{}) {
		t.Errorf("zero TLFEphemeralPublicKey (b3)")
	}

	if b4 == (TLFEphemeralPrivateKey{}) {
		t.Errorf("zero TLFEphemeralPrivateKey (b4)")
	}

	if b5 == (TLFCryptKey{}) {
		t.Errorf("zero TLFCryptKey (b5)")
	}

	if a1 == b1 {
		t.Errorf("a1 == b1")
	}

	if a2 == b2 {
		t.Errorf("a2 == b2")
	}

	if a3 == b3 {
		t.Errorf("a3 == b3")
	}

	if a4 == b4 {
		t.Errorf("a4 == b4")
	}

	if a5 == b5 {
		t.Errorf("a5 == b5")
	}
}

// Test (very superficially) that MakeRandomTLFCryptKeyServerHalf()
// returns non-zero values that aren't equal.
func TestCryptoCommonRandomTLFCryptKeyServerHalf(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	k1, err := c.MakeRandomTLFCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	if k1 == (TLFCryptKeyServerHalf{}) {
		t.Errorf("zero TLFCryptKeyServerHalf k1")
	}

	k2, err := c.MakeRandomTLFCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	if k2 == (TLFCryptKeyServerHalf{}) {
		t.Errorf("zero TLFCryptKeyServerHalf k2")
	}

	if k1 == k2 {
		t.Errorf("k1 == k2")
	}
}

// Test (very superficially) that MakeRandomBlockCryptKeyServerHalf()
// returns non-zero values that aren't equal.
func TestCryptoCommonRandomBlockCryptKeyServerHalf(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	k1, err := c.MakeRandomBlockCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	if k1 == (BlockCryptKeyServerHalf{}) {
		t.Errorf("zero BlockCryptKeyServerHalf k1")
	}

	k2, err := c.MakeRandomBlockCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	if k2 == (BlockCryptKeyServerHalf{}) {
		t.Errorf("zero BlockCryptKeyServerHalf k2")
	}

	if k1 == k2 {
		t.Errorf("k1 == k2")
	}
}

// Test that MaskTLFCryptKey() returns bytes that are different from
// the server half and the key, and that UnmaskTLFCryptKey() undoes
// the masking properly.
func TestCryptoCommonMaskUnmaskTLFCryptKey(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	serverHalf, err := c.MakeRandomTLFCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	_, _, _, _, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	clientHalf, err := c.MaskTLFCryptKey(serverHalf, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	if clientHalf.ClientHalf == serverHalf.ServerHalf {
		t.Error("client half == server half")
	}

	if clientHalf.ClientHalf == cryptKey.Key {
		t.Error("client half == key")
	}

	cryptKey2, err := c.UnmaskTLFCryptKey(serverHalf, clientHalf)
	if err != nil {
		t.Fatal(err)
	}

	if cryptKey2 != cryptKey {
		t.Error("cryptKey != cryptKey2")
	}
}

// Test that UnmaskBlockCryptKey() returns bytes that are different from
// the server half and the key.
func TestCryptoCommonUnmaskTLFCryptKey(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	serverHalf, err := c.MakeRandomBlockCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	_, _, _, _, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	key, err := c.UnmaskBlockCryptKey(serverHalf, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	if key.Key == serverHalf.ServerHalf {
		t.Error("key == server half")
	}

	if key.Key == cryptKey.Key {
		t.Error("key == crypt key")
	}
}

func TestCryptoCommonEncryptDecryptBlock(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	block := TestBlock{42}
	key := BlockCryptKey{}

	plainSize, encryptedBlock, err := c.EncryptBlock(block, key)
	if err != nil {
		t.Fatal(err)
	}

	if plainSize > len(encryptedBlock) {
		t.Errorf("plainSize=%d > encryptedSize=%d", plainSize, len(encryptedBlock))
	}

	var decryptedBlock TestBlock
	err = c.DecryptBlock(encryptedBlock, key, &decryptedBlock)
	if err != nil {
		t.Fatal(err)
	}

	if block != decryptedBlock {
		t.Errorf("Expected block %v got %v", block, decryptedBlock)
	}
}

// Test that crypto.Verify() rejects various types of bad signatures.
func TestCryptoCommonVerifyFailures(t *testing.T) {
	signingKey := MakeFakeSigningKeyOrBust("client sign")

	msg := []byte("message")
	sigInfo := SignatureInfo{
		Version:      SigED25519,
		Signature:    signingKey.kp.Private.Sign(msg)[:],
		VerifyingKey: signingKey.getVerifyingKey(),
	}

	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	var expectedErr, err error

	// Wrong version.

	sigInfoWrongVersion := sigInfo.DeepCopy()
	sigInfoWrongVersion.Version++
	expectedErr = UnknownSigVer{sigInfoWrongVersion.Version}
	err = c.Verify(msg, sigInfoWrongVersion)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Corrupt key.

	sigInfoCorruptKey := sigInfo.DeepCopy()
	sigInfoCorruptKey.VerifyingKey.KID = libkb.KID{}
	expectedErr = libkb.KeyCannotVerifyError{}
	err = c.Verify(msg, sigInfoCorruptKey)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Wrong sizes.

	shortSigInfo := sigInfo.DeepCopy()
	shortSigInfo.Signature = shortSigInfo.Signature[:len(shortSigInfo.Signature)-1]
	expectedErr = libkb.VerificationError{}
	err = c.Verify(msg, shortSigInfo)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	longSigInfo := sigInfo.DeepCopy()
	longSigInfo.Signature = append(longSigInfo.Signature, byte(0))
	expectedErr = libkb.VerificationError{}
	err = c.Verify(msg, longSigInfo)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Corrupt signature.

	corruptSigInfo := sigInfo.DeepCopy()
	corruptSigInfo.Signature[0] = ^sigInfo.Signature[0]
	expectedErr = libkb.VerificationError{}
	err = c.Verify(msg, corruptSigInfo)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Wrong key.

	sigInfoWrongKey := sigInfo.DeepCopy()
	sigInfoWrongKey.VerifyingKey = MakeFakeVerifyingKeyOrBust("wrong key")
	expectedErr = libkb.VerificationError{}
	err = c.Verify(msg, sigInfoWrongKey)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Corrupt message.

	corruptMsg := append(msg, []byte("corruption")...)
	expectedErr = libkb.VerificationError{}
	err = c.Verify(corruptMsg, sigInfo)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}
}

// Test that crypto.EncryptTLFCryptKeyClientHalf() encrypts its
// passed-in client half properly.
func TestCryptoCommonEncryptTLFCryptKeyClientHalf(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	_, _, ephPublicKey, ephPrivateKey, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	privateKey := MakeFakeCryptPrivateKeyOrBust("fake key")
	publicKey := privateKey.getPublicKey()

	serverHalf, err := c.MakeRandomTLFCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	clientHalf, err := c.MaskTLFCryptKey(serverHalf, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	encryptedClientHalf, err := c.EncryptTLFCryptKeyClientHalf(ephPrivateKey, publicKey, clientHalf)
	if err != nil {
		t.Fatal(err)
	}

	if encryptedClientHalf.Version != TLFEncryptionBox {
		t.Errorf("Expected version %v, got %v", TLFEncryptionBox, encryptedClientHalf.Version)
	}

	expectedEncryptedLength := len(clientHalf.ClientHalf) + box.Overhead
	if len(encryptedClientHalf.EncryptedData) != expectedEncryptedLength {
		t.Errorf("Expected encrypted length %d, got %d", expectedEncryptedLength, len(encryptedClientHalf.EncryptedData))
	}

	if len(encryptedClientHalf.Nonce) != 24 {
		t.Fatalf("Expected nonce length 24, got %d", len(encryptedClientHalf.Nonce))
	}

	var nonce [24]byte
	copy(nonce[:], encryptedClientHalf.Nonce)
	if nonce == ([24]byte{}) {
		t.Error("Empty nonce")
	}

	var ok bool
	decryptedData, ok := box.Open(nil, encryptedClientHalf.EncryptedData, &nonce, (*[32]byte)(&ephPublicKey.PublicKey), (*[32]byte)(privateKey.kp.Private))
	if !ok {
		t.Fatal("Decryption failed")
	}

	if len(decryptedData) != len(clientHalf.ClientHalf) {
		t.Fatalf("Expected decrypted data length %d, got %d", len(clientHalf.ClientHalf), len(decryptedData))
	}

	var clientHalf2 TLFCryptKeyClientHalf
	copy(clientHalf2.ClientHalf[:], decryptedData)
	if clientHalf != clientHalf2 {
		t.Fatal("client half != decrypted client half")
	}
}

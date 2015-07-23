package libkbfs

import (
	"bytes"
	"testing"
	"testing/quick"

	"golang.org/x/crypto/nacl/box"
	"golang.org/x/crypto/nacl/secretbox"

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

	_, encryptedBlock, err := c.EncryptBlock(block, key)
	if err != nil {
		t.Fatal(err)
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
	sigInfoCorruptKey.VerifyingKey.KID = ""
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

	if encryptedClientHalf.Version != EncryptionSecretbox {
		t.Errorf("Expected version %v, got %v", EncryptionSecretbox, encryptedClientHalf.Version)
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

func checkSecretboxOpen(t *testing.T, encryptedData encryptedData, key [32]byte) (encodedData []byte) {
	if encryptedData.Version != EncryptionSecretbox {
		t.Errorf("Expected version %v, got %v", EncryptionSecretbox, encryptedData.Version)
	}

	if len(encryptedData.Nonce) != 24 {
		t.Fatalf("Expected nonce length 24, got %d", len(encryptedData.Nonce))
	}

	var nonce [24]byte
	copy(nonce[:], encryptedData.Nonce)
	if nonce == ([24]byte{}) {
		t.Error("Empty nonce")
	}

	encodedData, ok := secretbox.Open(nil, encryptedData.EncryptedData, &nonce, &key)
	if !ok {
		t.Fatal("Decryption failed")
	}

	return encodedData
}

// Test that crypto.EncryptPrivateMetadata() encrypts its passed-in
// PrivateMetadata object properly.
func TestEncryptPrivateMetadata(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	_, tlfPrivateKey, _, _, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	privateMetadata := PrivateMetadata{
		TLFPrivateKey: tlfPrivateKey,
	}
	expectedEncodedPrivateMetadata, err := codec.Encode(privateMetadata)
	if err != nil {
		t.Fatal(err)
	}

	encryptedPrivateMetadata, err := c.EncryptPrivateMetadata(&privateMetadata, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	encodedPrivateMetadata := checkSecretboxOpen(t, encryptedData(encryptedPrivateMetadata), cryptKey.Key)

	if string(encodedPrivateMetadata) != string(expectedEncodedPrivateMetadata) {
		t.Fatalf("Expected encoded data %v, got %v", expectedEncodedPrivateMetadata, encodedPrivateMetadata)
	}
}

func secretboxSeal(t *testing.T, c *CryptoCommon, data interface{}, key [32]byte) encryptedData {
	encodedData, err := c.codec.Encode(data)
	if err != nil {
		t.Fatal(err)
	}

	return secretboxSealEncoded(t, c, encodedData, key)
}

func secretboxSealEncoded(t *testing.T, c *CryptoCommon, encodedData []byte, key [32]byte) encryptedData {
	var nonce [24]byte
	err := cryptoRandRead(nonce[:])
	if err != nil {
		t.Fatal(err)
	}

	sealedPmd := secretbox.Seal(nil, encodedData, &nonce, &key)

	return encryptedData{
		Version:       EncryptionSecretbox,
		Nonce:         nonce[:],
		EncryptedData: sealedPmd,
	}
}

// Test that crypto.DecryptPrivateMetadata() decrypts a
// PrivateMetadata object encrypted with the default method (current
// nacl/secretbox).
func TestDecryptPrivateMetadataSecretboxSeal(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	_, tlfPrivateKey, _, _, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	privateMetadata := PrivateMetadata{
		TLFPrivateKey: tlfPrivateKey,
	}

	encryptedPrivateMetadata := EncryptedPrivateMetadata(secretboxSeal(t, &c, privateMetadata, cryptKey.Key))

	decryptedPrivateMetadata, err := c.DecryptPrivateMetadata(encryptedPrivateMetadata, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	if !decryptedPrivateMetadata.Equals(privateMetadata) {
		t.Errorf("Decrypted private metadata %v doesn't match %v", decryptedPrivateMetadata, privateMetadata)
	}
}

// Test that crypto.DecryptPrivateMetadata() decrypts a
// PrivateMetadata object encrypted with the default method (current
// nacl/secretbox).
func TestDecryptEncryptedPrivateMetadata(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	_, tlfPrivateKey, _, _, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	privateMetadata := PrivateMetadata{
		TLFPrivateKey: tlfPrivateKey,
	}

	encryptedPrivateMetadata, err := c.EncryptPrivateMetadata(&privateMetadata, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	decryptedPrivateMetadata, err := c.DecryptPrivateMetadata(encryptedPrivateMetadata, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	if !decryptedPrivateMetadata.Equals(privateMetadata) {
		t.Errorf("Decrypted private metadata %v doesn't match %v", decryptedPrivateMetadata, privateMetadata)
	}
}

func checkDecryptionFailures(
	t *testing.T, encryptedData encryptedData, key interface{},
	decryptFn func(encryptedData encryptedData, key interface{}) error,
	corruptKeyFn func(interface{}) interface{}) {
	var err, expectedErr error

	// Wrong version.

	encryptedDataWrongVersion := encryptedData
	encryptedDataWrongVersion.Version++
	expectedErr = UnknownEncryptionVer{encryptedDataWrongVersion.Version}
	err = decryptFn(encryptedDataWrongVersion, key)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Wrong nonce size.

	encryptedDataWrongNonceSize := encryptedData
	encryptedDataWrongNonceSize.Nonce = encryptedDataWrongNonceSize.Nonce[:len(encryptedDataWrongNonceSize.Nonce)-1]
	expectedErr = InvalidNonceError{encryptedDataWrongNonceSize.Nonce}
	err = decryptFn(encryptedDataWrongNonceSize, key)
	if err.Error() != expectedErr.Error() {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Corrupt key.

	keyCorrupt := corruptKeyFn(key)
	expectedErr = libkb.DecryptionError{}
	err = decryptFn(encryptedData, keyCorrupt)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Corrupt data.

	encryptedDataCorruptData := encryptedData
	encryptedDataCorruptData.EncryptedData[0] = ^encryptedDataCorruptData.EncryptedData[0]
	expectedErr = libkb.DecryptionError{}
	err = decryptFn(encryptedDataCorruptData, key)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}
}

// Test various failure cases for crypto.DecryptPrivateMetadata().
func TestDecryptPrivateMetadataFailures(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	_, tlfPrivateKey, _, _, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	privateMetadata := PrivateMetadata{
		TLFPrivateKey: tlfPrivateKey,
	}

	encryptedPrivateMetadata, err := c.EncryptPrivateMetadata(&privateMetadata, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	checkDecryptionFailures(t, encryptedData(encryptedPrivateMetadata), cryptKey,
		func(encryptedData encryptedData, key interface{}) error {
			_, err = c.DecryptPrivateMetadata(EncryptedPrivateMetadata(encryptedData), key.(TLFCryptKey))
			return err
		},
		func(key interface{}) interface{} {
			cryptKey := key.(TLFCryptKey)
			cryptKeyCorrupt := cryptKey
			cryptKeyCorrupt.Key[0] = ^cryptKeyCorrupt.Key[0]
			return cryptKeyCorrupt
		})
}

func makeBlockCryptKey(t *testing.T, c *CryptoCommon) BlockCryptKey {
	_, _, _, _, tlfCryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	serverHalf, err := c.MakeRandomBlockCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	blockCryptKey, err := c.UnmaskBlockCryptKey(serverHalf, tlfCryptKey)
	if err != nil {
		t.Fatal(err)
	}

	return blockCryptKey
}

// Test that crypto.EncryptBlock() encrypts its passed-in Block object
// properly.
func TestEncryptBlock(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	cryptKey := makeBlockCryptKey(t, &c)

	block := 50
	expectedEncodedBlock, err := codec.Encode(block)
	if err != nil {
		t.Fatal(err)
	}

	plainSize, encryptedBlock, err := c.EncryptBlock(block, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	if plainSize != len(expectedEncodedBlock) {
		t.Errorf("Expected plain size %d, got %d", len(expectedEncodedBlock), plainSize)
	}

	paddedBlock := checkSecretboxOpen(t, encryptedData(encryptedBlock), cryptKey.Key)
	encodedBlock, err := c.depadBlock(paddedBlock)
	if err != nil {
		t.Fatal(err)
	}

	if string(encodedBlock) != string(expectedEncodedBlock) {
		t.Fatalf("Expected encoded data %v, got %v", expectedEncodedBlock, encodedBlock)
	}
}

// Test that crypto.DecryptBlock() decrypts a Block object encrypted
// with the default method (current nacl/secretbox).
func TestDecryptBlockSecretboxSeal(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	cryptKey := makeBlockCryptKey(t, &c)

	block := 50

	encodedBlock, err := codec.Encode(block)
	if err != nil {
		t.Fatal(err)
	}

	paddedBlock, err := c.padBlock(encodedBlock)
	if err != nil {
		t.Fatal(err)
	}

	encryptedBlock := EncryptedBlock(secretboxSealEncoded(t, &c, paddedBlock, cryptKey.Key))

	var decryptedBlock int
	err = c.DecryptBlock(encryptedBlock, cryptKey, &decryptedBlock)
	if err != nil {
		t.Fatal(err)
	}

	if decryptedBlock != block {
		t.Errorf("Decrypted block %d doesn't match %d", decryptedBlock, block)
	}
}

// Test that crypto.DecryptBlock() decrypts a Block object encrypted
// with the default method (current nacl/secretbox).
func TestDecryptEncryptedBlock(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	cryptKey := makeBlockCryptKey(t, &c)

	block := 50

	_, encryptedBlock, err := c.EncryptBlock(&block, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	var decryptedBlock int
	err = c.DecryptBlock(encryptedBlock, cryptKey, &decryptedBlock)
	if err != nil {
		t.Fatal(err)
	}

	if decryptedBlock != block {
		t.Errorf("Decrypted block %d doesn't match %d", decryptedBlock, block)
	}
}

// Test various failure cases for crypto.DecryptBlock().
func TestDecryptBlockFailures(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	cryptKey := makeBlockCryptKey(t, &c)

	block := 50

	_, encryptedBlock, err := c.EncryptBlock(&block, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	checkDecryptionFailures(t, encryptedData(encryptedBlock), cryptKey,
		func(encryptedData encryptedData, key interface{}) error {
			var dummy int
			return c.DecryptBlock(EncryptedBlock(encryptedData), key.(BlockCryptKey), &dummy)
		},
		func(key interface{}) interface{} {
			cryptKey := key.(BlockCryptKey)
			cryptKeyCorrupt := cryptKey
			cryptKeyCorrupt.Key[0] = ^cryptKeyCorrupt.Key[0]
			return cryptKeyCorrupt
		})
}

// Test padding of blocks results in a larger block, with length
// equal to power of 2 + 4.
func TestBlockPadding(t *testing.T) {
	var c CryptoCommon
	f := func(b []byte) bool {
		padded, err := c.padBlock(b)
		if err != nil {
			t.Logf("padBlock err: %s", err)
			return false
		}
		n := len(padded)
		if n <= len(b) {
			t.Logf("padBlock padded block len %d <= input block len %d", n, len(b))
			return false
		}
		// len of slice without uint32 prefix:
		h := n - 4
		if h&(h-1) != 0 {
			t.Logf("padBlock padded block len %d not a power of 2", h)
			return false
		}
		return true
	}

	if err := quick.Check(f, nil); err != nil {
		t.Error(err)
	}
}

// Tests padding -> depadding results in same block data.
func TestBlockDepadding(t *testing.T) {
	var c CryptoCommon
	f := func(b []byte) bool {
		padded, err := c.padBlock(b)
		if err != nil {
			t.Logf("padBlock err: %s", err)
			return false
		}
		depadded, err := c.depadBlock(padded)
		if err != nil {
			t.Logf("depadBlock err: %s", err)
			return false
		}
		if !bytes.Equal(b, depadded) {
			return false
		}
		return true
	}

	if err := quick.Check(f, nil); err != nil {
		t.Error(err)
	}
}

// Test that secretbox encrypted data length is deterministic.
func TestSecretboxEncryptedLen(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	for i := 100; i < 100000; i += 1000 {
		var enclen int
		for j := 0; j < 5; j++ {
			cryptKey := makeBlockCryptKey(t, &c)
			data := make([]byte, i)
			if err := cryptoRandRead(data); err != nil {
				t.Fatal(err)
			}
			enc := secretboxSeal(t, &c, data, cryptKey.Key)
			if j == 0 {
				enclen = len(enc.EncryptedData)
			} else {
				if len(enc.EncryptedData) != enclen {
					t.Errorf("encrypted data len: %d, expected %d", len(enc.EncryptedData), enclen)
				}
			}
		}
	}
}

// Test that block encrypted data length is the same for data
// length within same power of 2.
func TestBlockEncryptedLen(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}
	cryptKey := makeBlockCryptKey(t, &c)

	var expectedLen int
	for i := 1025; i < 2000; i++ {
		data := make([]byte, i)
		if err := cryptoRandRead(data); err != nil {
			t.Fatal(err)
		}
		_, encBlock, err := c.EncryptBlock(data, cryptKey)
		if err != nil {
			t.Fatal(err)
		}

		if expectedLen == 0 {
			expectedLen = len(encBlock.EncryptedData)
			continue
		}

		if len(encBlock.EncryptedData) != expectedLen {
			t.Errorf("len encrypted data: %d, expected %d (input len: %d)",
				len(encBlock.EncryptedData), expectedLen, i)
		}
	}
}

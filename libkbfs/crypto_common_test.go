package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

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
func TestCryptoClientVerifyFailures(t *testing.T) {
	signingKey := MakeFakeSigningKeyOrBust("client sign")

	msg := []byte("message")
	sigInfo := SignatureInfo{
		Version:      SigED25519,
		Signature:    signingKey.kp.Private.Sign(msg)[:],
		VerifyingKey: signingKey.GetVerifyingKey(),
	}

	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	var expectedErr, err error

	// Wrong version.

	sigInfoWrongVersion := sigInfo.DeepCopy()
	sigInfoWrongVersion.Version += 1
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

package libkbfs

import (
	"fmt"
	"testing"

	"golang.org/x/crypto/nacl/box"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type FakeCryptoClient struct {
	Local *CryptoLocal
}

func NewFakeCryptoClient(codec Codec, signingKey SigningKey, cryptPrivateKey CryptPrivateKey) *FakeCryptoClient {
	return &FakeCryptoClient{
		Local: NewCryptoLocal(codec, signingKey, cryptPrivateKey),
	}
}

func (fc FakeCryptoClient) Call(s string, args interface{}, res interface{}) error {
	switch s {
	case "keybase.1.crypto.signED25519":
		arg := args.([]interface{})[0].(keybase1.SignED25519Arg)
		sigInfo, err := fc.Local.Sign(arg.Msg)
		if err != nil {
			return err
		}
		sigRes := res.(*keybase1.ED25519SignatureInfo)
		// Normally, we'd have to validate all the parameters
		// in sigInfo, but since this is used in tests only,
		// there's no need.
		var ed25519Signature keybase1.ED25519Signature
		copy(ed25519Signature[:], sigInfo.Signature)
		publicKey := sigInfo.VerifyingKey.KID.ToNaclSigningKeyPublic()
		*sigRes = keybase1.ED25519SignatureInfo{
			Sig:       ed25519Signature,
			PublicKey: keybase1.ED25519PublicKey(*publicKey),
		}
		return nil

	case "keybase.1.crypto.unboxBytes32":
		arg := args.([]interface{})[0].(keybase1.UnboxBytes32Arg)
		publicKey := TLFEphemeralPublicKey{libkb.NaclDHKeyPublic(arg.PeersPublicKey)}
		encryptedClientHalf := EncryptedTLFCryptKeyClientHalf{
			Version:       TLFEncryptionBox,
			EncryptedData: arg.EncryptedBytes32[:],
			Nonce:         arg.Nonce[:],
		}
		clientHalf, err := fc.Local.DecryptTLFCryptKeyClientHalf(publicKey, encryptedClientHalf)
		if err != nil {
			return err
		}
		res := res.(*keybase1.Bytes32)
		*res = clientHalf.ClientHalf
		return nil

	default:
		return fmt.Errorf("Unknown call: %s %v %v", s, args, res)
	}
}

// Test that signing a message and then verifying it works.
func TestCryptoClientSignAndVerify(t *testing.T) {
	signingKey := MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := MakeFakeCryptPrivateKeyOrBust("client crypt private")
	codec := NewCodecMsgpack()
	fc := NewFakeCryptoClient(codec, signingKey, cryptPrivateKey)
	c := newCryptoClientWithClient(codec, nil, fc)

	msg := []byte("message")
	sigInfo, err := c.Sign(msg)
	if err != nil {
		t.Fatal(err)
	}

	err = c.Verify(msg, sigInfo)
	if err != nil {
		t.Error(err)
	}
}

// Test that decrypting an TLF crypt key client half encrypted with
// box.Seal works.
func TestCryptoClientDecryptTLFCryptKeyClientHalfBoxSeal(t *testing.T) {
	signingKey := MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := MakeFakeCryptPrivateKeyOrBust("client crypt private")
	codec := NewCodecMsgpack()
	fc := NewFakeCryptoClient(codec, signingKey, cryptPrivateKey)
	c := newCryptoClientWithClient(codec, nil, fc)

	_, _, ephPublicKey, ephPrivateKey, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	serverHalf, err := c.MakeRandomTLFCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	clientHalf, err := c.MaskTLFCryptKey(serverHalf, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	var nonce [24]byte
	err = cryptoRandRead(nonce[:])
	if err != nil {
		t.Fatal(err)
	}

	keypair, err := libkb.ImportKeypairFromKID(cryptPrivateKey.getPublicKey().KID)
	if err != nil {
		t.Fatal(err)
	}

	dhKeyPair, ok := keypair.(libkb.NaclDHKeyPair)
	if !ok {
		t.Fatal(libkb.KeyCannotEncryptError{})
	}

	encryptedData := box.Seal(nil, clientHalf.ClientHalf[:], &nonce, (*[32]byte)(&dhKeyPair.Public), (*[32]byte)(&ephPrivateKey.PrivateKey))
	encryptedClientHalf := EncryptedTLFCryptKeyClientHalf{
		Version:       TLFEncryptionBox,
		Nonce:         nonce[:],
		EncryptedData: encryptedData,
	}

	decryptedClientHalf, err := c.DecryptTLFCryptKeyClientHalf(ephPublicKey, encryptedClientHalf)
	if err != nil {
		t.Fatal(err)
	}

	if clientHalf != decryptedClientHalf {
		t.Error("clientHalf != decryptedClientHalf")
	}
}

// Test that decrypting a TLF crypt key client half encrypted with the
// default method (currently nacl/box) works.
func TestCryptoClientDecryptEncryptedTLFCryptKeyClientHalf(t *testing.T) {
	signingKey := MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := MakeFakeCryptPrivateKeyOrBust("client crypt private")
	codec := NewCodecMsgpack()
	fc := NewFakeCryptoClient(codec, signingKey, cryptPrivateKey)
	c := newCryptoClientWithClient(codec, nil, fc)

	_, _, ephPublicKey, ephPrivateKey, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	serverHalf, err := c.MakeRandomTLFCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	clientHalf, err := c.MaskTLFCryptKey(serverHalf, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	// See crypto_common_test.go for tests that this actually
	// performs encryption.
	encryptedClientHalf, err := c.EncryptTLFCryptKeyClientHalf(ephPrivateKey, cryptPrivateKey.getPublicKey(), clientHalf)
	if err != nil {
		t.Fatal(err)
	}

	if encryptedClientHalf.Version != TLFEncryptionBox {
		t.Fatalf("Unexpected encryption version %d", encryptedClientHalf.Version)
	}

	decryptedClientHalf, err := c.DecryptTLFCryptKeyClientHalf(ephPublicKey, encryptedClientHalf)
	if err != nil {
		t.Fatal(err)
	}

	if clientHalf != decryptedClientHalf {
		t.Error("clientHalf != decryptedClientHalf")
	}
}

// Test various failure cases for DecryptTLFCryptKeyClientHalf.
func TestCryptoClientDecryptTLFCryptKeyClientHalfFailures(t *testing.T) {
	signingKey := MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := MakeFakeCryptPrivateKeyOrBust("client crypt private")
	codec := NewCodecMsgpack()
	fc := NewFakeCryptoClient(codec, signingKey, cryptPrivateKey)
	c := newCryptoClientWithClient(codec, nil, fc)

	_, _, ephPublicKey, ephPrivateKey, cryptKey, err := c.MakeRandomTLFKeys()
	if err != nil {
		t.Fatal(err)
	}

	serverHalf, err := c.MakeRandomTLFCryptKeyServerHalf()
	if err != nil {
		t.Fatal(err)
	}

	clientHalf, err := c.MaskTLFCryptKey(serverHalf, cryptKey)
	if err != nil {
		t.Fatal(err)
	}

	encryptedClientHalf, err := c.EncryptTLFCryptKeyClientHalf(ephPrivateKey, cryptPrivateKey.getPublicKey(), clientHalf)
	if err != nil {
		t.Fatal(err)
	}

	var expectedErr error

	// Wrong version.

	encryptedClientHalfWrongVersion := encryptedClientHalf
	encryptedClientHalfWrongVersion.Version++
	expectedErr = UnknownTLFEncryptionVer{encryptedClientHalfWrongVersion.Version}
	_, err = c.DecryptTLFCryptKeyClientHalf(ephPublicKey, encryptedClientHalfWrongVersion)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Wrong sizes.

	encryptedClientHalfWrongSize := encryptedClientHalf
	encryptedClientHalfWrongSize.EncryptedData = encryptedClientHalfWrongSize.EncryptedData[:len(encryptedClientHalfWrongSize.EncryptedData)-1]
	expectedErr = libkb.DecryptionError{}
	_, err = c.DecryptTLFCryptKeyClientHalf(ephPublicKey, encryptedClientHalfWrongSize)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	encryptedClientHalfWrongNonceSize := encryptedClientHalf
	encryptedClientHalfWrongNonceSize.Nonce = encryptedClientHalfWrongSize.Nonce[:len(encryptedClientHalfWrongSize.Nonce)-1]
	expectedErr = libkb.DecryptionError{}
	_, err = c.DecryptTLFCryptKeyClientHalf(ephPublicKey, encryptedClientHalfWrongSize)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Corrupt key.

	ephPublicKeyCorrupt := ephPublicKey
	ephPublicKeyCorrupt.PublicKey[0] = ^ephPublicKeyCorrupt.PublicKey[0]
	expectedErr = libkb.DecryptionError{}
	_, err = c.DecryptTLFCryptKeyClientHalf(ephPublicKeyCorrupt, encryptedClientHalf)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}

	// Corrupt data.

	encryptedClientHalfCorruptData := encryptedClientHalf
	encryptedClientHalfCorruptData.EncryptedData[0] = ^encryptedClientHalfCorruptData.EncryptedData[0]
	expectedErr = libkb.DecryptionError{}
	_, err = c.DecryptTLFCryptKeyClientHalf(ephPublicKey, encryptedClientHalfCorruptData)
	if err != expectedErr {
		t.Errorf("Expected %v, got %v", expectedErr, err)
	}
}

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func doSign(tc libkb.TestContext, fu *FakeUser, msg []byte) ([]byte, error) {
	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	ctx := &Context{
		SecretUI: secui,
	}

	cse := NewCryptoSignEngine(tc.G, msg, "test reason")
	err := RunEngine(cse, ctx)
	if err != nil {
		return nil, err
	}

	return cse.GetSignature(), nil
}

func getDeviceSibkey(tc libkb.TestContext, username string) (libkb.GenericKey, error) {
	u, err := libkb.LoadUser(libkb.LoadUserArg{Name: username})
	if err != nil {
		return nil, err
	}

	sibkey, _, err := u.GetDeviceKeys()
	return sibkey, err
}

// Test that CryptoSignEngine yields a valid signature for its given
// message.
func TestCryptoSignAccept(t *testing.T) {
	tc := SetupEngineTest(t, "crypto_sign")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "sign")

	msg := []byte("test message")
	sig, err := doSign(tc, fu, msg)
	if err != nil {
		t.Fatal(err)
	}

	sibkey, err := getDeviceSibkey(tc, fu.Username)
	if err != nil {
		t.Fatal(err)
	}

	err = sibkey.VerifyBytes(sig, msg)
	if err != nil {
		t.Error(err)
	}
}

// Test that VerifyBytes rejects various types of bad signatures.
func TestCryptoSignReject(t *testing.T) {
	tc := SetupEngineTest(t, "crypto_sign")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "sign")

	msg := []byte("test message")
	sig, err := doSign(tc, fu, msg)
	if err != nil {
		t.Fatal(err)
	}

	sibkey, err := getDeviceSibkey(tc, fu.Username)
	if err != nil {
		t.Fatal(err)
	}

	// Corrupt signature.

	err = sibkey.VerifyBytes(append(sig, []byte("corruption")...), msg)
	if err == nil {
		t.Error("Verifying corrupt signature unexpectedly passes")
	}

	// Corrupt msg.

	err = sibkey.VerifyBytes(sig, append(msg, []byte("corruption")...))
	if err == nil {
		t.Error("Verifying signature for corrupt msg unexpectedly passes")
	}

	// Signature with different key.

	keyPair, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	sig2, err := keyPair.SignToBytes(msg)
	if err != nil {
		t.Fatal(err)
	}

	err = sibkey.VerifyBytes(sig2, msg)
	if err == nil {
		t.Error("Signature with different key unexpectedly passes")
	}
}

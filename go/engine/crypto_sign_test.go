package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

// Test that CryptoSignEngine yields the expected signature for its
// given message.
//
// (For tests that valid signatures are accepted and invalid
// signatures are rejected, see naclwrap_test.go.)
func TestCryptoSign(t *testing.T) {
	tc := SetupEngineTest(t, "crypto_sign")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "sign")

	msg := []byte("test message")

	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}

	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}

	sigKey, _, err := tc.G.Keyrings.GetSecretKeyWithPrompt(libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceKeyType,
	}, secui, "test reason")
	if err != nil {
		t.Fatal(err)
	}

	expectedSig, err := sigKey.SignToBytes(msg)
	if err != nil {
		t.Fatal(err)
	}

	cse := NewCryptoSignEngine(tc.G, msg, "test reason")
	ctx := &Context{
		SecretUI: secui,
	}
	err = RunEngine(cse, ctx)
	if err != nil {
		t.Error(err)
	}

	sig := cse.GetSignature()

	if string(sig) != string(expectedSig) {
		t.Errorf("Expected %v, got %v", expectedSig, sig)
	}
}

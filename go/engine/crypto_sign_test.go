package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

// Test that CryptoSignEngine yields a signature that the
// corresponding key can verify.
//
// (For general tests that valid signatures are accepted and invalid
// signatures are rejected, see naclwrap_test.go.)
func TestCryptoSign(t *testing.T) {
	tc := SetupEngineTest(t, "crypto_sign")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "sign")

	msg := []byte("test message")

	cse := NewCryptoSignEngine(tc.G, msg, "test reason")
	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	ctx := &Context{
		SecretUI: secui,
	}
	err := RunEngine(cse, ctx)
	if err != nil {
		t.Fatal(err)
	}

	signature := cse.GetSignature()
	verifyingKey := cse.GetVerifyingKey()
	err = verifyingKey.Verify(msg, &signature)
	if err != nil {
		t.Error(err)
	}
}

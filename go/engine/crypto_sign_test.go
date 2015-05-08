package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func getDeviceSibkey(tc libkb.TestContext, username string) (libkb.GenericKey, error) {
	u, err := libkb.LoadUser(libkb.LoadUserArg{Name: username})
	if err != nil {
		return nil, err
	}

	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		return nil, libkb.KeyFamilyError{"no key family available"}
	}

	did := tc.G.Env.GetDeviceID()
	if did == nil {
		return nil, libkb.NotProvisionedError{}
	}

	sibkey, err := ckf.GetSibkeyForDevice(*did)
	if err != nil {
		return nil, err
	}

	return sibkey, nil
}

func TestCryptoSign(t *testing.T) {
	tc := SetupEngineTest(t, "crypto_sign")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "sign")

	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	ctx := &Context{
		SecretUI: secui,
	}

	message := []byte("test message")
	cse := NewCryptoSignEngine(tc.G, message, "test reason")
	err := RunEngine(cse, ctx)
	if err != nil {
		t.Fatal(err)
	}

	sibkey, err := getDeviceSibkey(tc, fu.Username)
	if err != nil {
		t.Fatal(err)
	}

	_, err = sibkey.Verify(string(cse.GetSignature()), message)
	if err != nil {
		t.Error(err)
	}
}

package engine

import (
	"bytes"
	"testing"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
)

// TestPGPSavePublicPush runs the PGPSave engine, pushing the
// public key to api server and checks that it runs without error.
func TestPGPSave(t *testing.T) {
	tc := SetupEngineTest(t, "pgpsave")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(t, "login")
	secui := libkb.TestSecretUI{Passphrase: u.Passphrase}
	ctx := &Context{LogUI: G.UI.GetLogUI(), SecretUI: secui}

	// try all four permutations of push options:

	key := armorKey(t, tc, u.Email)
	e := NewPGPSaveArmored(key, false, false)
	if err := RunEngine(e, ctx, nil, nil); err != nil {
		t.Fatal(err)
	}

	key = armorKey(t, tc, u.Email)
	e = NewPGPSaveArmored(key, false, true)
	if err := RunEngine(e, ctx, nil, nil); err != nil {
		t.Fatal(err)
	}

	key = armorKey(t, tc, u.Email)
	e = NewPGPSaveArmored(key, true, false)
	if err := RunEngine(e, ctx, nil, nil); err != nil {
		t.Fatal(err)
	}

	key = armorKey(t, tc, u.Email)
	e = NewPGPSaveArmored(key, true, true)
	if err := RunEngine(e, ctx, nil, nil); err != nil {
		t.Fatal(err)
	}
}

func armorKey(t *testing.T, tc libkb.TestContext, email string) string {
	bundle, err := tc.MakePGPKey(email)
	if err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	writer, err := armor.Encode(&buf, "PGP PRIVATE KEY BLOCK", make(map[string]string))
	if err != nil {
		t.Fatal(err)
	}
	if err := (*openpgp.Entity)(bundle).SerializePrivate(writer, nil); err != nil {
		t.Fatal(err)
	}
	writer.Close()
	return string(buf.Bytes())
}

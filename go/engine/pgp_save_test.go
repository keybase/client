package engine

import (
	"bytes"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
)

// TestPGPSavePublicPush runs the PGPSave engine, pushing the
// public key to api server and checks that it runs without error.
func TestPGPImportAndExport(t *testing.T) {
	tc := SetupEngineTest(t, "pgpsave")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(t, "login")
	secui := libkb.TestSecretUI{Passphrase: u.Passphrase}
	ctx := &Context{LogUI: G.UI.GetLogUI(), SecretUI: secui}

	// try all four permutations of push options:

	key := armorKey(t, tc, u.Email)
	eng, err := NewPGPKeyImportEngineFromBytes([]byte(key), false)
	if err != nil {
		t.Fatal(err)
	}
	if err = RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	key = armorKey(t, tc, u.Email)
	eng, err = NewPGPKeyImportEngineFromBytes([]byte(key), true)
	if err != nil {
		t.Fatal(err)
	}
	if err = RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	arg := keybase_1.PgpExportArg{
		Secret: true,
		Query:  fp.String(),
	}

	xe := NewPGPKeyExportEngine(arg)
	if err := RunEngine(xe, ctx); err != nil {
		t.Fatal(err)
	}

	if len(xe.Results()) != 1 {
		t.Fatalf("Expected 1 key back out")
	}

	arg = keybase_1.PgpExportArg{
		Secret: true,
		Query:  fp.String()[0:10] + "aabb",
	}

	xe = NewPGPKeyExportEngine(arg)
	if err := RunEngine(xe, ctx); err == nil {
		t.Fatalf("Expected an error on fictious key")
	} else if _, ok := err.(libkb.NoSecretKeyError); !ok {
		t.Fatalf("Expected a 'NoSecretKeyError; got %s", err.Error())
	}

	arg = keybase_1.PgpExportArg{
		Secret: false,
	}
	xe = NewPGPKeyExportEngine(arg)
	if err := RunEngine(xe, ctx); err != nil {
		t.Fatal(err)
	}
	if len(xe.Results()) != 2 {
		t.Fatalf("Expected two keys back out; got %d", len(xe.Results()))
	}

	return
}

func armorKey(t *testing.T, tc libkb.TestContext, email string) (libkb.PgpFingerprint, string) {
	bundle, err := tc.MakePGPKey(email)
	if err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	writer, err := armor.Encode(&buf, "PGP PRIVATE KEY BLOCK", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := (*openpgp.Entity)(bundle).SerializePrivate(writer, nil); err != nil {
		t.Fatal(err)
	}
	writer.Close()
	fp := *bundle.GetFingerprintP()
	return fp, string(buf.Bytes())
}

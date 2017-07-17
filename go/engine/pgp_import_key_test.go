// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-crypto/openpgp/armor"
)

// TestPGPSavePublicPush runs the PGPSave engine, pushing the
// public key to api server and checks that it runs without error.
func TestPGPImportAndExport(t *testing.T) {
	tc := SetupEngineTest(t, "pgpsave")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	secui := &libkb.TestSecretUI{Passphrase: u.Passphrase}
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), SecretUI: secui}

	// try all four permutations of push options:

	fp, _, key := armorKey(t, tc, u.Email)
	eng, err := NewPGPKeyImportEngineFromBytes([]byte(key), false, tc.G)
	if err != nil {
		t.Fatal(err)
	}
	if err = RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	fp, _, key = armorKey(t, tc, u.Email)
	eng, err = NewPGPKeyImportEngineFromBytes([]byte(key), true, tc.G)
	if err != nil {
		t.Fatal(err)
	}
	if err = RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	arg := keybase1.PGPExportArg{
		Options: keybase1.PGPQuery{
			Secret: true,
			Query:  fp.String(),
		},
	}

	xe := NewPGPKeyExportEngine(arg, tc.G)
	if err := RunEngine(xe, ctx); err != nil {
		t.Fatal(err)
	}

	if len(xe.Results()) != 1 {
		t.Fatalf("Expected 1 key back out")
	}

	arg = keybase1.PGPExportArg{
		Options: keybase1.PGPQuery{
			Secret: true,
			Query:  fp.String()[0:10] + "aabb",
		},
	}

	xe = NewPGPKeyExportEngine(arg, tc.G)
	if err := RunEngine(xe, ctx); err != nil {
		t.Fatal(err)
	}
	if len(xe.Results()) != 0 {
		t.Fatalf("num keys exported: %d, expected 0", len(xe.Results()))
	}

	arg = keybase1.PGPExportArg{
		Options: keybase1.PGPQuery{
			Secret: false,
		},
	}
	xe = NewPGPKeyExportEngine(arg, tc.G)
	if err := RunEngine(xe, ctx); err != nil {
		t.Fatal(err)
	}
	if len(xe.Results()) != 2 {
		t.Fatalf("Expected two keys back out; got %d", len(xe.Results()))
	}

	return
}

// Test for issue 325.
func TestPGPImportPublicKey(t *testing.T) {
	tc := SetupEngineTest(t, "pgpsave")
	defer tc.Cleanup()

	_, err := NewPGPKeyImportEngineFromBytes([]byte(pubkeyIssue325), false, tc.G)
	if err == nil {
		t.Fatal("import of public key didn't generate error")
	}
	if _, ok := err.(libkb.NoSecretKeyError); !ok {
		t.Error(err)
		t.Errorf("error returned for import of public key: %T, expected libkb.NoSecretKeyError", err)
	}
}

func TestIssue454(t *testing.T) {
	testImportKey(t, "pgp454", keyIssue454, "test")
}

func TestIssue2147(t *testing.T) {
	testImportKey(t, "issue2147", keyIssue2147, keyIssue2147Passphrase)
}

func testImportKey(t *testing.T, which string, armor string, pp string) {
	tc := SetupEngineTest(t, which)
	defer tc.Cleanup()

	CreateAndSignupFakeUser(tc, "login")
	secui := &libkb.TestSecretUI{Passphrase: pp}
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), SecretUI: secui}
	eng, err := NewPGPKeyImportEngineFromBytes([]byte(armor), false, tc.G)
	eng.arg.OnlySave = true
	if err != nil {
		t.Fatal(err)
	}
	err = RunEngine(eng, ctx)
	if err != nil {
		t.Fatal(err)
	}
}

// Issue CORE-2063: check that generated secret key is exported
// to user's GPG keyring.
func TestPGPImportGPGExport(t *testing.T) {
	tc := SetupEngineTest(t, "pgpexp")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "pgp")
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), SecretUI: u.NewSecretUI()}

	// before running, they should have no pgp keys in key family or in gpg
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}
	if len(me.GetActivePGPKeys(false)) != 0 {
		t.Fatalf("active pgp keys: %d, expected 0", len(me.GetActivePGPKeys(false)))
	}
	gpgPrivate, err := numPrivateGPGKeys(tc.G)
	if err != nil {
		t.Fatal(err)
	}
	if gpgPrivate != 0 {
		t.Fatalf("private gpg keys: %d, expected 0", gpgPrivate)
	}

	// this is similar to how cmd_pgp_gen works:
	genArg := &libkb.PGPGenArg{
		PrimaryBits: 1024,
		SubkeyBits:  1024,
	}
	if err := genArg.MakeAllIds(); err != nil {
		t.Fatal(err)
	}
	arg := PGPKeyImportEngineArg{
		Gen:        genArg,
		PushSecret: true,
		AllowMulti: true,
		DoExport:   true,
		Ctx:        tc.G,
	}
	eng := NewPGPKeyImportEngine(arg)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	// after running, they should have one pgp keys in key family and in gpg
	me, err = libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}
	if len(me.GetActivePGPKeys(false)) != 1 {
		t.Errorf("active pgp keys: %d, expected 1", len(me.GetActivePGPKeys(false)))
	}
	gpgPrivate, err = numPrivateGPGKeys(tc.G)
	if err != nil {
		t.Fatal(err)
	}
	if gpgPrivate != 1 {
		t.Errorf("private gpg keys: %d, expected 1", gpgPrivate)
	}
}

func numPrivateGPGKeys(g *libkb.GlobalContext) (int, error) {
	gpg := g.GetGpgClient()
	if err := gpg.Configure(); err != nil {
		return 0, err
	}

	index, _, err := gpg.Index(true, "")
	if err != nil {
		return 0, err
	}

	return index.Len(), nil
}

func armorKey(t *testing.T, tc libkb.TestContext, email string) (libkb.PGPFingerprint, keybase1.KID, string) {
	bundle, err := tc.MakePGPKey(email)
	if err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	writer, err := armor.Encode(&buf, "PGP PRIVATE KEY BLOCK", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := bundle.Entity.SerializePrivate(writer, nil); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	fp := *bundle.GetFingerprintP()
	kid := bundle.GetKID()
	return fp, kid, string(buf.Bytes())
}

const pubkeyIssue325 = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Comment: GPGTools - http://gpgtools.org

mQENBFKK2rkBCADbZJNgrtb5AoBb6DFlCoP1PPXniOGwewDdnty7RJ/2Ue3NO+b2
xcq9ZG2Ex9TsgED0QPUTpdpgZGYHdNQggUPV4LKLaaDoXQ28sjGChKDKe6k6edkT
pL0wxhPrPSJRtlskHylHtbX/0pYVxdgr4o1UwPOmavt8EXYZazOPfphW+bUw9rpk
P7VNnVRUDTANIJeaVuwI+iAyHv4PBDBx0Ffuqv4t/qufYGz1ajbn6itkfRSbrsm6
ruGkr9cxnGoH8ViO6U8ymFQpaXlALE8P5AWM8GSjWleFZJYvW0xlX2aSG+w8mEz0
+SxH6LJSs70z7DOCadzEfS0hXhNYRsLGkmOTABEBAAG0IVZNIFN0cmFrYSA8d2hv
aXNzdHJha2FAZ21haWwuY29tPokBOAQTAQIAIgUCUorauQIbLwYLCQgHAwIGFQgC
CQoLBBYCAwECHgECF4AACgkQnpQQj0+PXPkKpwf9H7e5x+ePbVWlcK7ItTmd8Y/y
M3Pyt7/w+xyJnTd8q1boc7YSioyH9cv+e3xSohSebmf3q1+INY2UvmPCsvI8jKa4
k1ELuWPoX8aMs9zimj03pDm8y4zg/uzCnzubB1ufH7wUA4R429zlkfVIVNFK6c7T
SF6KWQ7hWWhhOGk6A5pCqhSewwQDD+J2AhXCGg31kf7zdWV+w6qGE2UR6/sdU2Yk
sgKholqh9EqH+iyXLtHP81MO7gM5ZBtyjUSlEhM9ULPbzQVcqJGhOZxMNhWHlPf/
l37DX0KIAhthgHAkXCZepAMIFysEz715KRREPfO4R+RFbgQJlkzq3kcQN1tP2LkB
DQRSitq5AQgA6KHIG5HDpuk5yDu7pXk90/zS8wmOhIkBV/esb7Jtnf1ifCv7//gU
q7WwSwokC+/wWCei2M98ppLTZJvx21pbdvCK98WLJ2o87T/bY7WvdePovEuYZbJf
twxNyCzYlD3RgpcFB2O3V6Jck0BJOLrgsdpMCPIm3cozHrcOUn8xFuNB0JTuO3wX
yRYVwZNKQOjJvTT/be6wp8EhXEm+VrCkCQIm+JxxDXQPh1uFctqB1gBnnVg/E1bF
2j5sTWXYIC6Z2VnfRddcVI6DAaR6HjZpOyU69/dUoqDyH5M2bHL7SjDiR8Yudbad
ho3x3ekbkRSfm6w1NaqlUk3ZwlfS2mmtOQARAQABiQI+BBgBAgAJBQJSitq5Ahsu
ASkJEJ6UEI9Pj1z5wF0gBBkBAgAGBQJSitq5AAoJECkBgjGGUFa+pXMIANOnZaWt
WQ4FiG3cUs6pkGUTK1UuU11d7Oq9/xgL23rf8eFcbPx4MzCAr2B00ybVdgIlMogI
P6G6Gb3K4WZsO3/qxTlkY/xjRT9xGvairfzpC/pm999sqqLdZOao3rG2rBG8kDXE
8TrgiVQgbT7f4OHmMN6JndZtEDIP3hcDc1d+YDAOVIG0SfY9e8fGrm7dZGW8mRzE
tb30T1anWnkwYmLbAKrZ3VgrBQ3mYB0twl9OEoGuGn5yjdfCDcg7kVpyxEAU4qNd
YpwIdXqc9vod8XJNaJxFAkyuQkZxLvPPYbPPbwalaFEa1kWimtfNbnhEOsmunkMo
oeOz5pFxSBjw4e5tBgf8DHhh3SFje/lGA6vq/B+h4NpSise8xb/5TevGW/xfIMO7
UYxzShu2xXoTA2O+ZqYH/SnFrY0GmjWSabSeAJDzxroMwKhBhtwVm65gBh3svdZd
bri+WozCFabzQXfjeHrj6mgInivvlkq5oBZgndnLSq7XWadigoJYhcLaVqi9dJ3O
3JBnY8xHf4V9aSTyTEajqBIUN3JBddtnUpr8Y+XGy8uEAmnsQsc16bqleoodUcTp
pr9YE8HhWfG0w9fddZe9ZYcwFs+Qe6bM+JSFJkB+o47AtEcv9dEhQ0g87oRH+DO5
/RRJzo7QQNKzG8juDwrYhKQJ6WrSFaT/a6IEGhvvgg==
=DDQ1
-----END PGP PUBLIC KEY BLOCK-----`

const keyIssue454 = `-----BEGIN PGP PRIVATE KEY BLOCK-----
Comment: GPGTools - http://gpgtools.org

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
LpRtxqDTDVA6H/R+dqEhg/ni2jAapEr4VzIbew==
=bXrj
-----END PGP PRIVATE KEY BLOCK-----`

const keyIssue2147 = `-----BEGIN PGP PRIVATE KEY BLOCK-----
Version: GnuPG v1

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
=aaae
-----END PGP PRIVATE KEY BLOCK-----
`
const keyIssue2147Passphrase = "abcd"

package engine

import (
	"bytes"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
)

// TestPGPSavePublicPush runs the PGPSave engine, pushing the
// public key to api server and checks that it runs without error.
func TestPGPImportAndExport(t *testing.T) {
	tc := SetupEngineTest(t, "pgpsave")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	secui := libkb.TestSecretUI{Passphrase: u.Passphrase}
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
	t.Skip("this test only works once")
	tc := SetupEngineTest(t, "pgp454")
	defer tc.Cleanup()

	CreateAndSignupFakeUser(tc, "login")
	secui := libkb.TestSecretUI{Passphrase: "test"}
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), SecretUI: secui}
	eng, err := NewPGPKeyImportEngineFromBytes([]byte(keyIssue454), false, tc.G)
	if err != nil {
		t.Fatal(err)
	}
	err = RunEngine(eng, ctx)
	if err != nil {
		t.Fatal(err)
	}
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
	if err := (*openpgp.Entity)(bundle).SerializePrivate(writer, nil); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	fp := *bundle.GetFingerprintP()
	kid := bundle.GetKid()
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

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

	u := CreateAndSignupFakeUser(t, "login")
	secui := libkb.TestSecretUI{Passphrase: u.Passphrase}
	ctx := &Context{LogUI: G.UI.GetLogUI(), SecretUI: secui}

	// try all four permutations of push options:

	fp, key := armorKey(t, tc, u.Email)
	eng, err := NewPGPKeyImportEngineFromBytes([]byte(key), false, G)
	if err != nil {
		t.Fatal(err)
	}
	if err = RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	fp, key = armorKey(t, tc, u.Email)
	eng, err = NewPGPKeyImportEngineFromBytes([]byte(key), true, G)
	if err != nil {
		t.Fatal(err)
	}
	if err = RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	arg := keybase1.PgpExportArg{
		Secret: true,
		Query:  fp.String(),
	}

	xe := NewPGPKeyExportEngine(arg, tc.G)
	if err := RunEngine(xe, ctx); err != nil {
		t.Fatal(err)
	}

	if len(xe.Results()) != 1 {
		t.Fatalf("Expected 1 key back out")
	}

	arg = keybase1.PgpExportArg{
		Secret: true,
		Query:  fp.String()[0:10] + "aabb",
	}

	xe = NewPGPKeyExportEngine(arg, tc.G)
	if err := RunEngine(xe, ctx); err == nil {
		t.Fatalf("Expected an error on fictious key")
	} else if _, ok := err.(libkb.NoSecretKeyError); !ok {
		t.Fatalf("Expected a 'NoSecretKeyError; got %s", err.Error())
	}

	arg = keybase1.PgpExportArg{
		Secret: false,
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

	u := CreateAndSignupFakeUser(t, "login")
	secui := libkb.TestSecretUI{Passphrase: u.Passphrase}
	ctx := &Context{LogUI: G.UI.GetLogUI(), SecretUI: secui}
	eng, err := NewPGPKeyImportEngineFromBytes([]byte(pubkeyIssue325), false, G)
	if err != nil {
		t.Fatal(err)
	}
	err = RunEngine(eng, ctx)
	if err == nil {
		t.Fatal("import of public key didn't generate error")
	}
	if _, ok := err.(libkb.NoSecretKeyError); !ok {
		t.Error(err)
		t.Errorf("error returned for import of public key: %T, expected libkb.NoSecretKeyError", err)
	}
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

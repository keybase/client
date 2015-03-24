package engine

import (
	"bytes"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestPGPDecrypt(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPOnly(t, tc)

	// encrypt a message
	msg := "10 days in Japan"
	trackUI := &FakeIdentifyUI{}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: fu.NewSecretUI()}
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Source:       strings.NewReader(msg),
		Sink:         sink,
		NoSign:       true,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(arg)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// decrypt it
	var decoded bytes.Buffer
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   &decoded,
	}
	dec := NewPGPDecrypt(decarg)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}
}

func TestPGPDecryptArmored(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPOnly(t, tc)

	// encrypt a message
	msg := "10 days in Japan"
	trackUI := &FakeIdentifyUI{}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: fu.NewSecretUI()}
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Source: strings.NewReader(msg),
		Sink:   sink,
		NoSign: true,
	}
	enc := NewPGPEncrypt(arg)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// decrypt it
	var decoded bytes.Buffer
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   &decoded,
	}
	dec := NewPGPDecrypt(decarg)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}
}

// TestPGPDecryptSignedSelf tests that the user who signed the
// message can decrypt it.
func TestPGPDecryptSignedSelf(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPOnly(t, tc)

	// encrypt a message
	msg := "We pride ourselves on being meticulous; no issue is too small."
	trackUI := &FakeIdentifyUI{}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: fu.NewSecretUI()}
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Source:       strings.NewReader(msg),
		Sink:         sink,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(arg)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// decrypt it
	var decoded bytes.Buffer
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   &decoded,
	}
	dec := NewPGPDecrypt(decarg)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}
}

// TestPGPDecryptSignedOther tests that a user who didn't sign the
// message can verify the signature.
func TestPGPDecryptSignedOther(t *testing.T) {
	tcRecipient := SetupEngineTest(t, "PGPDecrypt - Recipient")
	defer tcRecipient.Cleanup()
	recipient := createFakeUserWithPGPSibkey(t)
	G.LoginState.Logout()

	tcSigner := SetupEngineTest(t, "PGPDecrypt - Signer")
	defer tcSigner.Cleanup()
	signer := createFakeUserWithPGPOnly(t, tcSigner)

	// encrypt a message
	msg := "We pride ourselves on being meticulous; no issue is too small."
	trackUI := &FakeIdentifyUI{}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: signer.NewSecretUI()}
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips:       []string{recipient.Username},
		Source:       strings.NewReader(msg),
		Sink:         sink,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(arg)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// signer logs out, recipient logs in:
	t.Logf("signer (%q) logging out", signer.Username)
	tcSigner.G.LoginState.Logout()
	libkb.G = tcRecipient.G
	G = &libkb.G
	t.Logf("recipient (%q) logging in", recipient.Username)
	recipient.LoginOrBust(t)

	ctx = &Context{SecretUI: recipient.NewSecretUI()}

	// decrypt it
	var decoded bytes.Buffer
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   &decoded,
	}
	dec := NewPGPDecrypt(decarg)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}
}

// TestScanKeys tests libkb.ScanKey, but needs to be an engine
// test since it needs to have a logged in user to work.
func TestScanKeys(t *testing.T) {
	tc := SetupEngineTest(t, "ScanKeys")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "login")
	u, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}

	sk, err := libkb.NewScanKeys(u, fu.NewSecretUI())
	if err != nil {
		t.Fatal(err)
	}

	if sk.Count() != 0 {
		t.Errorf("scankey count: %d, expected 0", sk.Count())
	}
}

// TestScanKeysSync checks a user with a synced
func TestScanKeysSync(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPOnly(t, tc)
	u, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}

	sk, err := libkb.NewScanKeys(u, fu.NewSecretUI())
	if err != nil {
		t.Fatal(err)
	}

	if sk.Count() != 1 {
		t.Errorf("scankey count: %d, expected 1", sk.Count())
	}
}
func createFakeUserWithPGPSibkey(t *testing.T) *FakeUser {
	fu := CreateAndSignupFakeUser(t, "pgp")
	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
	}
	arg.Gen.MakeAllIds()
	ctx := Context{
		LogUI:    G.UI.GetLogUI(),
		SecretUI: secui,
	}
	eng := NewPGPKeyImportEngine(arg)
	err := RunEngine(eng, &ctx)
	if err != nil {
		t.Fatal(err)
	}
	return fu
}

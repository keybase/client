package engine

import (
	"bytes"
	"os"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func decengctx(fu *FakeUser, tc libkb.TestContext) *Context {
	return &Context{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   fu.NewSecretUI(),
		LogUI:      tc.G.UI.GetLogUI(),
	}
}

func TestPGPDecrypt(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPOnly(t, tc)

	// encrypt a message
	msg := "10 days in Japan"
	sink := libkb.NewBufferCloser()
	ctx := decengctx(fu, tc)
	arg := &PGPEncryptArg{
		Source:       strings.NewReader(msg),
		Sink:         sink,
		NoSign:       true,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   decoded,
	}
	dec := NewPGPDecrypt(decarg, tc.G)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}

	owner := dec.Owner()
	if owner == nil {
		t.Errorf("owner is nil")
	}
}

func TestPGPDecryptArmored(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPOnly(t, tc)

	// encrypt a message
	msg := "10 days in Japan"
	ctx := decengctx(fu, tc)
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Source: strings.NewReader(msg),
		Sink:   sink,
		NoSign: true,
	}
	enc := NewPGPEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   decoded,
	}
	dec := NewPGPDecrypt(decarg, tc.G)
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
	ctx := decengctx(fu, tc)
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Source:       strings.NewReader(msg),
		Sink:         sink,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source:       bytes.NewReader(out),
		Sink:         decoded,
		AssertSigned: true,
	}
	dec := NewPGPDecrypt(decarg, tc.G)
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
	recipient := createFakeUserWithPGPSibkey(tcRecipient)
	Logout(tcRecipient)

	tcSigner := SetupEngineTest(t, "PGPDecrypt - Signer")
	defer tcSigner.Cleanup()
	signer := createFakeUserWithPGPSibkey(tcSigner)

	// encrypt a message
	msg := "We pride ourselves on being meticulous; no issue is too small."
	ctx := decengctx(signer, tcSigner)
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips:       []string{recipient.Username},
		Source:       strings.NewReader(msg),
		Sink:         sink,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(arg, tcSigner.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// signer logs out, recipient logs in:
	t.Logf("signer (%q) logging out", signer.Username)
	Logout(tcSigner)
	libkb.G = tcRecipient.G
	// G = libkb.G
	t.Logf("recipient (%q) logging in", recipient.Username)
	recipient.LoginOrBust(tcRecipient)

	rtrackUI := &FakeIdentifyUI{
		Fapr: keybase1.FinishAndPromptRes{TrackRemote: true},
	}
	ctx = &Context{IdentifyUI: rtrackUI, SecretUI: recipient.NewSecretUI(), LogUI: tcRecipient.G.UI.GetLogUI()}

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source:       bytes.NewReader(out),
		Sink:         decoded,
		AssertSigned: true,
	}
	dec := NewPGPDecrypt(decarg, tcRecipient.G)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}
}

func TestPGPDecryptLong(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPSibkey(tc)

	// encrypt a message
	msg := make([]byte, 1024*1024)
	f, err := os.Open("/dev/urandom")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if _, err := f.Read(msg); err != nil {
		t.Fatal(err)
	}

	sink := libkb.NewBufferCloser()
	ctx := decengctx(fu, tc)
	arg := &PGPEncryptArg{
		Source:       bytes.NewReader(msg),
		Sink:         sink,
		NoSign:       true,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   decoded,
	}
	dec := NewPGPDecrypt(decarg, tc.G)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.Bytes()
	if len(decmsg) != len(msg) {
		t.Fatalf("decoded msg size: %d, expected %d", len(decmsg), len(msg))
	}

	for i, b := range msg {
		if decmsg[i] != b {
			t.Errorf("decode msg differs at byte %d: %x, expected %x", i, decmsg[i], b)
		}
	}

	owner := dec.Owner()
	if owner == nil {
		t.Errorf("owner is nil")
	}
}

type cstest struct {
	name string
	msg  string
}

var cstests = []cstest{
	{name: "ascii", msg: "hello"},
	{name: "emoji", msg: "😓😕😙"},
}

func TestPGPDecryptClearsign(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()

	fu := createFakeUserWithPGPSibkey(tc)
	ctx := decengctx(fu, tc)

	for _, test := range cstests {
		signedMsg := sign(ctx, tc, test.msg, keybase1.SignMode_CLEAR)
		t.Logf("%s: signed message:\n\n%s\n", test.name, signedMsg)

		decoded := libkb.NewBufferCloser()
		arg := &PGPDecryptArg{
			Source: strings.NewReader(signedMsg),
			Sink:   decoded,
		}
		eng := NewPGPDecrypt(arg, tc.G)
		if err := RunEngine(eng, ctx); err != nil {
			t.Errorf("%s: decrypt error: %q", test.name, err)
			continue
		}
		msg := decoded.Bytes()
		trimmed := strings.TrimSpace(string(msg))
		t.Logf("clearsign test %q decoded message: %s\n", test.name, trimmed)
		if trimmed != test.msg {
			t.Errorf("%s: expected msg %q, got %q", test.name, test.msg, trimmed)
		}

		status := eng.SignatureStatus()
		if !status.IsSigned {
			t.Errorf("%s: expected IsSigned", test.name)
		}
		if !status.Verified {
			t.Errorf("%s: expected Verified", test.name)
		}
		if status.Entity == nil {
			t.Errorf("%s: signature status entity is nil", test.name)
		}
	}
}

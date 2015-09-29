package engine

import (
	"io/ioutil"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func TestPGPVerify(t *testing.T) {
	tc := SetupEngineTest(t, "PGPVerify")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPSibkey(tc)

	ctx := &Context{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   fu.NewSecretUI(),
		LogUI:      tc.G.UI.GetLogUI(),
	}

	msg := "If you wish to stop receiving notifications from this topic, please click or visit the link below to unsubscribe:"

	// create detached sig
	detached := sign(ctx, tc, msg, keybase1.SignMode_DETACHED)

	// create clearsign sig
	clearsign := sign(ctx, tc, msg, keybase1.SignMode_CLEAR)

	// create attached sig w/ sign
	attached := sign(ctx, tc, msg, keybase1.SignMode_ATTACHED)

	// create attached sig w/ encrypt
	attachedEnc := signEnc(ctx, tc, msg)

	// Start with a fresh secret ui so the Called* flags will be false.
	// If the verify() func works, it will ensure that the ones it cares
	// about are false after each time it is called.
	ctx.SecretUI = fu.NewSecretUI()

	// still logged in as signer:
	verify(ctx, tc, msg, detached, "detached logged in", true)
	verify(ctx, tc, clearsign, "", "clearsign logged in", true)
	verify(ctx, tc, attached, "", "attached logged in", true)
	verify(ctx, tc, attachedEnc, "", "attached/encrypted logged in", true)

	Logout(tc)

	// these are all valid logged out
	verify(ctx, tc, msg, detached, "detached logged out", true)
	verify(ctx, tc, clearsign, "", "clearsign logged out", true)
	verify(ctx, tc, attached, "", "attached logged out", true)
	// attached encrypted is not valid logged out:
	verify(ctx, tc, attachedEnc, "", "attached/encrypted logged out", false)

	// sign in as a different user
	tc2 := SetupEngineTest(t, "PGPVerify")
	defer tc2.Cleanup()
	fu2 := CreateAndSignupFakeUser(tc2, "pgp")

	ctx.SecretUI = fu2.NewSecretUI()
	verify(ctx, tc2, msg, detached, "detached different user", true)
	verify(ctx, tc2, clearsign, "", "clearsign different user", true)
	verify(ctx, tc2, attached, "", "attached different user", true)
	verify(ctx, tc2, attachedEnc, "", "attached/encrypted different user", false)

	// extra credit:
	// encrypt a message for another user and sign it
	// verify that attached signature
}

func sign(ctx *Context, tc libkb.TestContext, msg string, mode keybase1.SignMode) string {
	sink := libkb.NewBufferCloser()
	arg := &PGPSignArg{
		Sink:   sink,
		Source: ioutil.NopCloser(strings.NewReader(msg)),
		Opts:   keybase1.PGPSignOptions{Mode: keybase1.SignMode(mode)},
	}
	eng := NewPGPSignEngine(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		tc.T.Fatal(err)
	}
	return sink.String()
}

func signEnc(ctx *Context, tc libkb.TestContext, msg string) string {
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Sink:         sink,
		Source:       strings.NewReader(msg),
		TrackOptions: keybase1.TrackOptions{BypassConfirm: true},
	}
	eng := NewPGPEncrypt(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		tc.T.Fatal(err)
	}
	return sink.String()
}

func verify(ctx *Context, tc libkb.TestContext, msg, sig, name string, valid bool) {
	arg := &PGPVerifyArg{
		Source:       strings.NewReader(msg),
		Signature:    []byte(sig),
		TrackOptions: keybase1.TrackOptions{BypassConfirm: true},
	}
	eng := NewPGPVerify(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		if valid {
			tc.T.Logf("%s: sig: %s", name, sig)
			tc.T.Errorf("%s not valid: %s", name, err)
		}
		return
	}
	if !valid {
		tc.T.Errorf("%s validated, but it shouldn't have", name)
	}
	s, ok := ctx.SecretUI.(*libkb.TestSecretUI)
	if !ok {
		tc.T.Fatalf("%s: invalid secret ui: %T", name, ctx.SecretUI)
	}
	if s.CalledGetSecret {
		tc.T.Errorf("%s: called get secret, shouldn't have", name)
		s.CalledGetSecret = false // reset it for next caller
	}
	if s.CalledGetKBPassphrase {
		tc.T.Errorf("%s: called get kb passphrase, shouldn't have", name)
		s.CalledGetKBPassphrase = false // reset it for next caller
	}
}

package engine

import (
	"io/ioutil"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
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
		Sink:   sink,
		Source: strings.NewReader(msg),
	}
	eng := NewPGPEncrypt(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		tc.T.Fatal(err)
	}
	return sink.String()
}

func verify(ctx *Context, tc libkb.TestContext, msg, sig, name string, valid bool) {
	arg := &PGPVerifyArg{
		Source:    strings.NewReader(msg),
		Signature: []byte(sig),
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
}

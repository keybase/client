package engine

import (
	"io/ioutil"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

func TestPGPVerify(t *testing.T) {
	tc := SetupEngineTest(t, "PGPVerify")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPSibkey(t)

	ctx := &Context{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   fu.NewSecretUI(),
		LogUI:      G.UI.GetLogUI(),
	}

	msg := "If you wish to stop receiving notifications from this topic, please click or visit the link below to unsubscribe:"

	// create detached sig
	detached := sign(ctx, t, msg, keybase_1.SignMode_DETACHED)

	// create clearsign sig
	clearsign := sign(ctx, t, msg, keybase_1.SignMode_CLEAR)

	// create attached sig w/ sign
	attached := sign(ctx, t, msg, keybase_1.SignMode_ATTACHED)

	// create attached sig w/ encrypt

	// still logged in as signer:
	verify(ctx, t, msg, detached, "detached logged in", false, true)
	verify(ctx, t, clearsign, "", "clearsign logged in", true, true)
	verify(ctx, t, attached, "", "attached logged in", false, true)
	// verify attached #2

	// log out, then
	G.LoginState.Logout()

	verify(ctx, t, msg, detached, "detached logged out", false, true)
	verify(ctx, t, clearsign, "", "clearsign logged out", true, true)
	verify(ctx, t, attached, "", "attached logged out", false, false)
	// verify attached #2 => err

	// sign in as a different user
	tc2 := SetupEngineTest(t, "PGPVerify")
	defer tc2.Cleanup()
	fu2 := CreateAndSignupFakeUser(t, "pgp")
	ctx.SecretUI = fu2.NewSecretUI()
	verify(ctx, t, msg, detached, "detached different user", false, true)
	verify(ctx, t, clearsign, "", "clearsign different user", true, true)
	t.Logf("fu username: %s", fu.Username)
	t.Logf("fu2 username: %s", fu2.Username)
	verify(ctx, t, attached, "", "attached different user", false, false)

	// extra credit:
	// encrypt a message for another user and sign it
	// verify that attached signature
}

func sign(ctx *Context, t *testing.T, msg string, mode int) string {
	sink := libkb.NewBufferCloser()
	arg := &PGPSignArg{
		Sink:   sink,
		Source: ioutil.NopCloser(strings.NewReader(msg)),
		Opts:   keybase_1.PgpSignOptions{Mode: keybase_1.SignMode(mode)},
	}
	eng := NewPGPSignEngine(arg)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	return sink.String()
}

func verify(ctx *Context, t *testing.T, msg, sig, name string, clear, valid bool) {
	arg := &PGPVerifyArg{
		Source:    strings.NewReader(msg),
		Signature: []byte(sig),
		Clearsign: clear,
	}
	eng := NewPGPVerify(arg)
	if err := RunEngine(eng, ctx); err != nil {
		if valid {
			t.Logf("%s: sig: %s", name, sig)
			t.Errorf("%s not valid: %s", name, err)
		}
		return
	}
	if !valid {
		t.Errorf("%s validated, but it shouldn't have", name)
	}
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"io/ioutil"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func doVerify(t *testing.T, msg string) {
	tc := SetupEngineTest(t, "PGPVerify")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPSibkey(tc)

	uis := libkb.UIs{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   fu.NewSecretUI(),
		LogUI:      tc.G.UI.GetLogUI(),
		PgpUI:      &TestPgpUI{},
	}

	m := NewMetaContextForTest(tc).WithUIs(uis)

	// create detached sig
	detached := sign(m, tc, msg, keybase1.SignMode_DETACHED)

	// create clearsign sig
	clearsign := sign(m, tc, msg, keybase1.SignMode_CLEAR)

	// create attached sig w/ sign
	attached := sign(m, tc, msg, keybase1.SignMode_ATTACHED)

	// create attached sig w/ encrypt
	attachedEnc := signEnc(m, tc, msg)

	// Start with a fresh secret ui so the Called* flags will be false.
	// If the verify() func works, it will ensure that the ones it cares
	// about are false after each time it is called.
	m = m.WithSecretUI(fu.NewSecretUI())

	// still logged in as signer:
	verify(m, tc, msg, detached, "detached logged in", true)
	verify(m, tc, clearsign, "", "clearsign logged in", true)
	verify(m, tc, attached, "", "attached logged in", true)
	verify(m, tc, attachedEnc, "", "attached/encrypted logged in", true)

	Logout(tc)

	// these are all valid logged out
	verify(m, tc, msg, detached, "detached logged out", true)
	verify(m, tc, clearsign, "", "clearsign logged out", true)
	verify(m, tc, attached, "", "attached logged out", true)
	// attached encrypted is not valid logged out:
	verify(m, tc, attachedEnc, "", "attached/encrypted logged out", false)

	// sign in as a different user
	tc2 := SetupEngineTest(t, "PGPVerify")
	defer tc2.Cleanup()
	fu2 := CreateAndSignupFakeUser(tc2, "pgp")

	m = m.WithSecretUI(fu2.NewSecretUI())
	verify(m, tc2, msg, detached, "detached different user", true)
	verify(m, tc2, clearsign, "", "clearsign different user", true)
	verify(m, tc2, attached, "", "attached different user", true)
	verify(m, tc2, attachedEnc, "", "attached/encrypted different user", false)

	// extra credit:
	// encrypt a message for another user and sign it
	// verify that attached signature
}

func TestPGPVerify(t *testing.T) {
	msg := "If you wish to stop receiving notifications from this topic, please click or visit the link below to unsubscribe:"
	doVerify(t, msg)
}

func TestPGPVerifyShortMsg(t *testing.T) {
	msg := "less than 100 characters"
	doVerify(t, msg)
}

func sign(m libkb.MetaContext, tc libkb.TestContext, msg string, mode keybase1.SignMode) string {
	sink := libkb.NewBufferCloser()
	arg := &PGPSignArg{
		Sink:   sink,
		Source: ioutil.NopCloser(strings.NewReader(msg)),
		Opts:   keybase1.PGPSignOptions{Mode: keybase1.SignMode(mode)},
	}
	eng := NewPGPSignEngine(tc.G, arg)
	if err := RunEngine2(m, eng); err != nil {
		tc.T.Fatal(err)
	}
	return sink.String()
}

func signEnc(m libkb.MetaContext, tc libkb.TestContext, msg string) string {
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Sink:   sink,
		Source: strings.NewReader(msg),
	}
	eng := NewPGPEncrypt(tc.G, arg)
	if err := RunEngine2(m, eng); err != nil {
		tc.T.Fatal(err)
	}
	return sink.String()
}

func verify(m libkb.MetaContext, tc libkb.TestContext, msg, sig, name string, valid bool) {
	arg := &PGPVerifyArg{
		Source:    strings.NewReader(msg),
		Signature: []byte(sig),
	}
	eng := NewPGPVerify(tc.G, arg)
	if err := RunEngine2(m, eng); err != nil {
		if valid {
			tc.T.Logf("%s: sig: %s", name, sig)
			tc.T.Errorf("%s not valid: %s", name, err)
		}
		return
	}
	if !valid {
		tc.T.Errorf("%s validated, but it shouldn't have", name)
	}
	s, ok := m.UIs().SecretUI.(*libkb.TestSecretUI)
	if !ok {
		tc.T.Fatalf("%s: invalid secret ui: %T", name, m.UIs().SecretUI)
	}
	if s.CalledGetPassphrase {
		tc.T.Errorf("%s: called get passphrase, shouldn't have", name)
		s.CalledGetPassphrase = false // reset it for next caller
	}
	p, ok := m.UIs().PgpUI.(*TestPgpUI)
	if !ok {
		tc.T.Fatalf("%s: invalid pgp ui: %T", name, m.UIs().PgpUI)
	}
	if p.OutputCount == 0 {
		tc.T.Errorf("%s: did not output signature success", name)
	}
}

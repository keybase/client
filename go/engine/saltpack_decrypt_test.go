// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestSaltPackDecrypt(t *testing.T) {
	tc := SetupEngineTest(t, "SaltPackDecrypt")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "naclp")

	// encrypt a message
	msg := "10 days in Japan"
	sink := libkb.NewBufferCloser()
	ctx := &Context{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   fu.NewSecretUI(),
		LogUI:      tc.G.UI.GetLogUI(),
	}
	// Should encrypt for self, too.
	arg := &SaltPackEncryptArg{
		Source: strings.NewReader(msg),
		Sink:   sink,
	}
	enc := NewSaltPackEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.String()

	t.Logf("encrypted data: %s", out)

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &SaltPackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	dec := NewSaltPackDecrypt(decarg, tc.G)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	if decmsg != msg {
		t.Errorf("decoded: %s, expected: %s", decmsg, msg)
	}
}

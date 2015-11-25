// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestKBCMFDecrypt(t *testing.T) {
	tc := SetupEngineTest(t, "KBCMFDecrypt")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "kbcmf")

	// encrypt a message
	msg := "10 days in Japan"
	sink := libkb.NewBufferCloser()
	ctx := &Context{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   fu.NewSecretUI(),
		LogUI:      tc.G.UI.GetLogUI(),
	}
	// Should encrypt for self, too.
	arg := &KBCMFEncryptArg{
		Recips: []string{},
		Source: strings.NewReader(msg),
		Sink:   sink,
	}
	enc := NewKBCMFEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.String()

	t.Logf("encrypted data: %s", out)

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &KBCMFDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	dec := NewKBCMFDecrypt(decarg, tc.G)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	if decmsg != msg {
		t.Errorf("decoded: %s, expected: %s", decmsg, msg)
	}
}

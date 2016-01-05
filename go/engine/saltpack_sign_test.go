// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"io/ioutil"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func TestSaltPackSignDeviceRequired(t *testing.T) {
	tc := SetupEngineTest(t, "sign")
	defer tc.Cleanup()

	ctx := &Context{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewSaltPackSign(nil, tc.G)
	err := RunEngine(eng, ctx)
	if err == nil {
		t.Fatal("sign not logged in returned no error")
	}
	if _, ok := err.(libkb.DeviceRequiredError); !ok {
		t.Errorf("error type: %T, expected DeviceRequiredError", err)
	}
}

func TestSaltPackSignVerify(t *testing.T) {
	tc := SetupEngineTest(t, "sign")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "sign")

	// signTests are defined in pgp_sign_test.  Make sure that saltpack sign can
	// sign/verify the same messages as pgp.
	for _, test := range signTests {
		var sink bytes.Buffer

		sarg := &SaltPackSignArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: ioutil.NopCloser(bytes.NewBufferString(test.input)),
		}

		eng := NewSaltPackSign(sarg, tc.G)
		ctx := &Context{
			IdentifyUI: &FakeIdentifyUI{},
			SecretUI:   fu.NewSecretUI(),
		}

		if err := RunEngine(eng, ctx); err != nil {
			t.Errorf("%s: run error: %s", test.name, err)
			continue
		}

		sig := sink.String()

		if len(sig) == 0 {
			t.Errorf("%s: empty sig", test.name)
		}

		varg := &SaltPackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(sig),
		}
		veng := NewSaltPackVerify(varg, tc.G)

		ctx.SaltPackUI = fakeSaltPackUI{}

		if err := RunEngine(veng, ctx); err != nil {
			t.Errorf("%s: verify error: %s", test.name, err)
			continue
		}
	}

	// now try the same messages, but generate detached signatures
	for _, test := range signTests {
		var sink bytes.Buffer

		sarg := &SaltPackSignArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: ioutil.NopCloser(bytes.NewBufferString(test.input)),
			Opts: keybase1.SaltPackSignOptions{
				Detached: true,
			},
		}

		eng := NewSaltPackSign(sarg, tc.G)
		ctx := &Context{
			IdentifyUI: &FakeIdentifyUI{},
			SecretUI:   fu.NewSecretUI(),
		}

		if err := RunEngine(eng, ctx); err != nil {
			t.Errorf("(detached) %s: run error: %s", test.name, err)
			continue
		}

		sig := sink.Bytes()

		if len(sig) == 0 {
			t.Errorf("(detached) %s: empty sig", test.name)
		}

		varg := &SaltPackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(test.input),
			Opts: keybase1.SaltPackVerifyOptions{
				Signature: sig,
			},
		}
		veng := NewSaltPackVerify(varg, tc.G)

		ctx.SaltPackUI = fakeSaltPackUI{}

		if err := RunEngine(veng, ctx); err != nil {
			t.Errorf("(detached) %s: verify error: %s", test.name, err)
			continue
		}
	}
}

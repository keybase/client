// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"io/ioutil"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/saltpack"
)

func TestSaltpackSignDeviceRequired(t *testing.T) {
	tc := SetupEngineTest(t, "sign")
	defer tc.Cleanup()

	ctx := &Context{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewSaltpackSign(nil, tc.G)
	err := RunEngine(eng, ctx)
	if err == nil {
		t.Fatal("sign not logged in returned no error")
	}
	if _, ok := err.(libkb.DeviceRequiredError); !ok {
		t.Errorf("error type: %T, expected DeviceRequiredError", err)
	}
}

func TestSaltpackSignVerify(t *testing.T) {
	tc := SetupEngineTest(t, "sign")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "sign")

	// signTests are defined in pgp_sign_test.  Make sure that saltpack sign can
	// sign/verify the same messages as pgp.
	for _, test := range signTests {
		var sink bytes.Buffer

		sarg := &SaltpackSignArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: ioutil.NopCloser(bytes.NewBufferString(test.input)),
		}

		eng := NewSaltpackSign(sarg, tc.G)
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

		varg := &SaltpackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(sig),
		}
		veng := NewSaltpackVerify(varg, tc.G)

		ctx.SaltpackUI = fakeSaltpackUI{}

		if err := RunEngine(veng, ctx); err != nil {
			t.Errorf("%s: verify error: %s", test.name, err)
			continue
		}

		// test SignedBy option:
		varg = &SaltpackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(sig),
			Opts: keybase1.SaltpackVerifyOptions{
				SignedBy: fu.Username,
			},
		}
		veng = NewSaltpackVerify(varg, tc.G)
		if err := RunEngine(veng, ctx); err != nil {
			t.Errorf("%s: verify w/ SignedBy error: %s", test.name, err)
			continue
		}

		varg = &SaltpackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(sig),
			Opts: keybase1.SaltpackVerifyOptions{
				SignedBy: "unknown",
			},
		}
		veng = NewSaltpackVerify(varg, tc.G)
		if err := RunEngine(veng, ctx); err == nil {
			t.Errorf("%s: verify w/ SignedBy=unknown worked, should have failed", test.name)
			continue
		}
	}

	// now try the same messages, but generate detached signatures
	for _, test := range signTests {
		var sink bytes.Buffer

		sarg := &SaltpackSignArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: ioutil.NopCloser(bytes.NewBufferString(test.input)),
			Opts: keybase1.SaltpackSignOptions{
				Detached: true,
			},
		}

		eng := NewSaltpackSign(sarg, tc.G)
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

		varg := &SaltpackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(test.input),
			Opts: keybase1.SaltpackVerifyOptions{
				Signature: sig,
			},
		}
		veng := NewSaltpackVerify(varg, tc.G)

		ctx.SaltpackUI = fakeSaltpackUI{}

		if err := RunEngine(veng, ctx); err != nil {
			t.Errorf("(detached) %s: verify error: %s", test.name, err)
			continue
		}
	}
}

func TestSaltpackSignVerifyBinary(t *testing.T) {
	tc := SetupEngineTest(t, "sign")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "sign")

	// signTests are defined in pgp_sign_test.  Make sure that saltpack sign can
	// sign/verify the same messages as pgp.
	for _, test := range signTests {
		var sink bytes.Buffer

		sarg := &SaltpackSignArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: ioutil.NopCloser(bytes.NewBufferString(test.input)),
			Opts: keybase1.SaltpackSignOptions{
				Binary: true,
			},
		}

		eng := NewSaltpackSign(sarg, tc.G)
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

		varg := &SaltpackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(sig),
		}
		veng := NewSaltpackVerify(varg, tc.G)

		ctx.SaltpackUI = fakeSaltpackUI{}

		if err := RunEngine(veng, ctx); err != nil {
			t.Errorf("%s: verify error: %s", test.name, err)
			continue
		}
	}

	// now try the same messages, but generate detached signatures
	for _, test := range signTests {
		var sink bytes.Buffer

		sarg := &SaltpackSignArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: ioutil.NopCloser(bytes.NewBufferString(test.input)),
			Opts: keybase1.SaltpackSignOptions{
				Binary:   true,
				Detached: true,
			},
		}

		eng := NewSaltpackSign(sarg, tc.G)
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

		varg := &SaltpackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(test.input),
			Opts: keybase1.SaltpackVerifyOptions{
				Signature: sig,
			},
		}
		veng := NewSaltpackVerify(varg, tc.G)

		ctx.SaltpackUI = fakeSaltpackUI{}

		if err := RunEngine(veng, ctx); err != nil {
			t.Errorf("(detached) %s: verify error: %s", test.name, err)
			continue
		}
	}
}

func TestSaltpackSignVerifyNotSelf(t *testing.T) {
	tc := SetupEngineTest(t, "sign")
	defer tc.Cleanup()

	signer := CreateAndSignupFakeUser(tc, "sign")

	var sink bytes.Buffer

	sarg := &SaltpackSignArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: ioutil.NopCloser(bytes.NewBufferString("this is from me")),
	}

	eng := NewSaltpackSign(sarg, tc.G)
	ctx := &Context{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   signer.NewSecretUI(),
	}

	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	sig := sink.String()

	if len(sig) == 0 {
		t.Fatal("empty sig")
	}

	Logout(tc)

	_ = CreateAndSignupFakeUser(tc, "sign")

	// no user assertion
	varg := &SaltpackVerifyArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: strings.NewReader(sig),
	}
	veng := NewSaltpackVerify(varg, tc.G)

	ctx.SaltpackUI = fakeSaltpackUI{}

	if err := RunEngine(veng, ctx); err != nil {
		t.Fatalf("verify error: %s", err)
	}

	// valid user assertion
	varg = &SaltpackVerifyArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: strings.NewReader(sig),
		Opts: keybase1.SaltpackVerifyOptions{
			SignedBy: signer.Username,
		},
	}
	veng = NewSaltpackVerify(varg, tc.G)
	if err := RunEngine(veng, ctx); err != nil {
		t.Fatalf("verify w/ SignedBy error: %s", err)
	}

	// invalid user assertion
	varg = &SaltpackVerifyArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: strings.NewReader(sig),
		Opts: keybase1.SaltpackVerifyOptions{
			SignedBy: "unknown",
		},
	}
	veng = NewSaltpackVerify(varg, tc.G)
	if err := RunEngine(veng, ctx); err == nil {
		t.Errorf("verify w/ SignedBy unknown didn't fail")
	}
}

func TestSaltpackVerifyRevoked(t *testing.T) {
	tc := SetupEngineTest(t, "sign")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "sign")

	var sink bytes.Buffer

	sarg := &SaltpackSignArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: ioutil.NopCloser(bytes.NewBufferString("test input wooo")),
	}

	eng := NewSaltpackSign(sarg, tc.G)
	ctx := &Context{
		LogUI:      tc.G.UI.GetLogUI(),
		LoginUI:    &libkb.TestLoginUI{},
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   fu.NewSecretUI(),
	}

	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	// Get the current device
	devices, _ := getActiveDevicesAndKeys(tc, fu)
	if len(devices) != 1 {
		t.Fatalf("Expected a single device, but found %d", len(devices))
	}
	currentDevice := devices[0]

	// Delegate a new paper key so that we have something active after we
	// revoke the current device.
	paperEng := NewPaperKey(tc.G)
	if err := RunEngine(paperEng, ctx); err != nil {
		t.Fatal(err)
	}

	// Revoke the current device.
	err := doRevokeDevice(tc, fu, currentDevice.ID, false)
	if err == nil {
		tc.T.Fatal("Expected revoking the current device to fail.")
	}
	// force=true is required for the current device
	err = doRevokeDevice(tc, fu, currentDevice.ID, true)
	if err != nil {
		tc.T.Fatal(err)
	}

	// Finally verify the sig. This should be an error, because the signing
	// device is revoked. The revoked status will get passed to our
	// fakeSaltpackUI's SaltpackVerifyBadSender method, made into an error, and
	// propagated all the way back here. Unfortunately we can't really test the
	// force option here, because that's implemented in the real client
	// SaltpackUI.
	sig := sink.String()
	if len(sig) == 0 {
		t.Fatal("empty sig")
	}
	varg := &SaltpackVerifyArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: strings.NewReader(sig),
	}
	veng := NewSaltpackVerify(varg, tc.G)
	ctx.SaltpackUI = fakeSaltpackUI{}
	err = RunEngine(veng, ctx)
	if err == nil {
		t.Fatal("expected error during verify")
	}
	badSenderError, ok := err.(*FakeBadSenderError)
	if !ok {
		t.Fatal("expected FakeBadSenderError during verify")
	}
	if badSenderError.senderType != keybase1.SaltpackSenderType_REVOKED {
		t.Fatalf("expected keybase1.SaltpackSenderType_REVOKED, got %s", badSenderError.senderType.String())
	}

	//
}

func TestSaltpackSignForceVersion(t *testing.T) {
	tc := SetupEngineTest(t, "sign")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "sign")

	run := func(versionFlag int, majorVersionExpected int) {
		// For each run, test both the attached and detached sig modes.
		for _, isAttached := range []bool{true, false} {
			var sink bytes.Buffer
			sarg := &SaltpackSignArg{
				Sink:   libkb.NopWriteCloser{W: &sink},
				Source: ioutil.NopCloser(bytes.NewBufferString("some test input")),
				Opts: keybase1.SaltpackSignOptions{
					Binary:          true,
					SaltpackVersion: versionFlag,
					Detached:        !isAttached,
				},
			}
			eng := NewSaltpackSign(sarg, tc.G)
			ctx := &Context{
				IdentifyUI: &FakeIdentifyUI{},
				SecretUI:   fu.NewSecretUI(),
			}
			if err := RunEngine(eng, ctx); err != nil {
				t.Fatal(err)
			}

			// Double decode the header and inspect it.
			var header saltpack.EncryptionHeader
			dec := codec.NewDecoderBytes(sink.Bytes(), &codec.MsgpackHandle{WriteExt: true})
			var b []byte
			if err := dec.Decode(&b); err != nil {
				t.Fatal(err)
			}
			dec = codec.NewDecoderBytes(b, &codec.MsgpackHandle{WriteExt: true})
			if err := dec.Decode(&header); err != nil {
				t.Fatal(err)
			}

			if header.Version.Major != majorVersionExpected {
				t.Fatalf("passed saltpack version %d (attached: %t) and expected major version %d, found %d", versionFlag, isAttached, majorVersionExpected, header.Version.Major)
			}
		}
	}

	// 0 means the default, which is major version 2.
	run(0, 2)
	run(1, 1)
	run(2, 2)
}

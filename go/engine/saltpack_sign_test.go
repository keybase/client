// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"io"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/saltpack"
	"github.com/stretchr/testify/require"
)

func TestSaltpackSignDeviceRequired(t *testing.T) {
	tc := SetupEngineTest(t, "sign")
	defer tc.Cleanup()

	uis := libkb.UIs{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewSaltpackSign(tc.G, nil)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.Error(t, err,
		"sign not logged in returned no error")
	_, ok := err.(libkb.DeviceRequiredError)
	require.True(t, ok, "error type: %T, expected DeviceRequiredError", err)
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
			Source: io.NopCloser(bytes.NewBufferString(test.input)),
		}

		eng := NewSaltpackSign(tc.G, sarg)
		uis := libkb.UIs{
			IdentifyUI: &FakeIdentifyUI{},
			SecretUI:   fu.NewSecretUI(),
		}

		m := NewMetaContextForTest(tc).WithUIs(uis)
		err := RunEngine2(m, eng)
		require.NoError(t, err, "%s: run error: %s", test.name, err)

		sig := sink.String()

		require.False(t, len(sig) == 0, "%s: empty sig", test.name)

		varg := &SaltpackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(sig),
		}
		veng := NewSaltpackVerify(tc.G, varg)

		m = m.WithSaltpackUI(fakeSaltpackUI{})

		err = RunEngine2(m, veng)
		require.NoError(t, err, "%s: verify error: %s", test.name, err)

		// test SignedBy option:
		varg = &SaltpackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(sig),
			Opts: keybase1.SaltpackVerifyOptions{
				SignedBy: fu.Username,
			},
		}
		veng = NewSaltpackVerify(tc.G, varg)
		err = RunEngine2(m, veng)
		require.NoError(t, err, "%s: verify w/ SignedBy error: %s", test.name, err)

		varg = &SaltpackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(sig),
			Opts: keybase1.SaltpackVerifyOptions{
				SignedBy: "unknown",
			},
		}
		veng = NewSaltpackVerify(tc.G, varg)
		err = RunEngine2(m, veng)
		require.NotNil(t, err, "%s: verify w/ SignedBy=unknown worked, should have failed", test.name)
	}

	// now try the same messages, but generate detached signatures
	for _, test := range signTests {
		var sink bytes.Buffer

		sarg := &SaltpackSignArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: io.NopCloser(bytes.NewBufferString(test.input)),
			Opts: keybase1.SaltpackSignOptions{
				Detached: true,
			},
		}

		eng := NewSaltpackSign(tc.G, sarg)
		uis := libkb.UIs{
			IdentifyUI: &FakeIdentifyUI{},
			SecretUI:   fu.NewSecretUI(),
		}
		m := NewMetaContextForTest(tc).WithUIs(uis)
		err := RunEngine2(m, eng)
		require.NoError(t, err, "(detached) %s: run error: %s", test.name, err)

		sig := sink.Bytes()

		require.False(t, len(sig) == 0, "(detached) %s: empty sig", test.name)

		varg := &SaltpackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(test.input),
			Opts: keybase1.SaltpackVerifyOptions{
				Signature: sig,
			},
		}

		veng := NewSaltpackVerify(tc.G, varg)
		m = m.WithSaltpackUI(fakeSaltpackUI{})
		err = RunEngine2(m, veng)
		require.NoError(t, err, "(detached) %s: verify error: %s", test.name, err)
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
			Source: io.NopCloser(bytes.NewBufferString(test.input)),
			Opts: keybase1.SaltpackSignOptions{
				Binary: true,
			},
		}

		eng := NewSaltpackSign(tc.G, sarg)
		uis := libkb.UIs{
			IdentifyUI: &FakeIdentifyUI{},
			SecretUI:   fu.NewSecretUI(),
		}
		m := NewMetaContextForTest(tc).WithUIs(uis)
		err := RunEngine2(m, eng)
		require.NoError(t, err, "%s: run error: %s", test.name, err)

		sig := sink.String()

		require.False(t, len(sig) == 0, "%s: empty sig", test.name)

		varg := &SaltpackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(sig),
		}
		veng := NewSaltpackVerify(tc.G, varg)

		m = m.WithSaltpackUI(fakeSaltpackUI{})

		err = RunEngine2(m, veng)
		require.NoError(t, err, "%s: verify error: %s", test.name, err)
	}

	// now try the same messages, but generate detached signatures
	for _, test := range signTests {
		var sink bytes.Buffer

		sarg := &SaltpackSignArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: io.NopCloser(bytes.NewBufferString(test.input)),
			Opts: keybase1.SaltpackSignOptions{
				Binary:   true,
				Detached: true,
			},
		}

		eng := NewSaltpackSign(tc.G, sarg)
		uis := libkb.UIs{
			IdentifyUI: &FakeIdentifyUI{},
			SecretUI:   fu.NewSecretUI(),
		}
		m := NewMetaContextForTest(tc).WithUIs(uis)
		err := RunEngine2(m, eng)
		require.NoError(t, err, "(detached) %s: run error: %s", test.name, err)

		sig := sink.Bytes()

		require.False(t, len(sig) == 0, "(detached) %s: empty sig", test.name)

		varg := &SaltpackVerifyArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: strings.NewReader(test.input),
			Opts: keybase1.SaltpackVerifyOptions{
				Signature: sig,
			},
		}
		veng := NewSaltpackVerify(tc.G, varg)
		m = m.WithSaltpackUI(fakeSaltpackUI{})

		err = RunEngine2(m, veng)
		require.NoError(t, err, "(detached) %s: verify error: %s", test.name, err)
	}
}

func TestSaltpackSignVerifyNotSelf(t *testing.T) {
	tc := SetupEngineTest(t, "sign")
	defer tc.Cleanup()

	signer := CreateAndSignupFakeUser(tc, "sign")

	var sink bytes.Buffer

	sarg := &SaltpackSignArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: io.NopCloser(bytes.NewBufferString("this is from me")),
	}

	eng := NewSaltpackSign(tc.G, sarg)
	uis := libkb.UIs{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   signer.NewSecretUI(),
	}

	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		require.NoError(t, err)
	}

	sig := sink.String()

	require.NotEmpty(t, sig, "empty sig")

	Logout(tc)

	_ = CreateAndSignupFakeUser(tc, "sign")

	// no user assertion
	varg := &SaltpackVerifyArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: strings.NewReader(sig),
	}
	veng := NewSaltpackVerify(tc.G, varg)

	m = m.WithSaltpackUI(fakeSaltpackUI{})

	if err := RunEngine2(m, veng); err != nil {
		require.NoError(t, err,
			"verify error: %s", err)
	}

	// valid user assertion
	varg = &SaltpackVerifyArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: strings.NewReader(sig),
		Opts: keybase1.SaltpackVerifyOptions{
			SignedBy: signer.Username,
		},
	}
	veng = NewSaltpackVerify(tc.G, varg)
	if err := RunEngine2(m, veng); err != nil {
		require.NoError(t, err,
			"verify w/ SignedBy error: %s", err)
	}

	// invalid user assertion
	varg = &SaltpackVerifyArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: strings.NewReader(sig),
		Opts: keybase1.SaltpackVerifyOptions{
			SignedBy: "unknown",
		},
	}
	veng = NewSaltpackVerify(tc.G, varg)
	err := RunEngine2(m, veng)
	require.NotNil(t, err, "verify w/ SignedBy unknown didn't fail")
}

func TestSaltpackVerifyRevoked(t *testing.T) {
	tc := SetupEngineTest(t, "sign")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "sign")

	var sink bytes.Buffer

	sarg := &SaltpackSignArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: io.NopCloser(bytes.NewBufferString("test input wooo")),
	}

	eng := NewSaltpackSign(tc.G, sarg)
	uis := libkb.UIs{
		LogUI:      tc.G.UI.GetLogUI(),
		LoginUI:    &libkb.TestLoginUI{},
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   fu.NewSecretUI(),
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		require.NoError(t, err)
	}

	// Get the current device
	devices, _ := getActiveDevicesAndKeys(tc, fu)
	require.Len(t, devices, 1, "Expected a single device, but found %d", len(devices))
	currentDevice := devices[0]

	// Delegate a new paper key so that we have something active after we
	// revoke the current device.
	paperEng := NewPaperKey(tc.G)
	if err := RunEngine2(m, paperEng); err != nil {
		require.NoError(t, err)
	}

	// Revoke the current device.
	err := doRevokeDevice(tc, fu, currentDevice.ID, false, false)
	require.Error(tc.T, err,
		"Expected revoking the current device to fail.")
	// force=true is required for the current device
	err = doRevokeDevice(tc, fu, currentDevice.ID, true, false)
	require.NoError(tc.T, err)

	// Finally verify the sig. This should be an error, because the signing
	// device is revoked. The revoked status will get passed to our
	// fakeSaltpackUI's SaltpackVerifyBadSender method, made into an error, and
	// propagated all the way back here. Unfortunately we can't really test the
	// force option here, because that's implemented in the real client
	// SaltpackUI.
	sig := sink.String()
	require.NotEmpty(t, sig, "empty sig")
	varg := &SaltpackVerifyArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: strings.NewReader(sig),
	}
	veng := NewSaltpackVerify(tc.G, varg)
	m = m.WithSaltpackUI(fakeSaltpackUI{})
	err = RunEngine2(m, veng)
	require.Error(t, err,
		"expected error during verify")
	verificationError, ok := err.(libkb.VerificationError)
	require.True(t, ok,
		"expected VerificationError during verify")
	badSenderError, ok := verificationError.Cause.Err.(*FakeBadSenderError)
	require.True(t, ok,
		"expected FakeBadSenderError during verify")

	require.Equal(t, keybase1.SaltpackSenderType_REVOKED, badSenderError.senderType, "expected keybase1.SaltpackSenderType_REVOKED, got %s", badSenderError.senderType.String())
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
				Source: io.NopCloser(bytes.NewBufferString("some test input")),
				Opts: keybase1.SaltpackSignOptions{
					Binary:          true,
					SaltpackVersion: versionFlag,
					Detached:        !isAttached,
				},
			}
			eng := NewSaltpackSign(tc.G, sarg)
			uis := libkb.UIs{
				IdentifyUI: &FakeIdentifyUI{},
				SecretUI:   fu.NewSecretUI(),
			}
			m := NewMetaContextForTest(tc).WithUIs(uis)
			if err := RunEngine2(m, eng); err != nil {
				require.NoError(t, err)
			}

			// Double decode the header and inspect it.
			var header saltpack.EncryptionHeader
			dec := codec.NewDecoderBytes(sink.Bytes(), &codec.MsgpackHandle{WriteExt: true})
			var b []byte
			if err := dec.Decode(&b); err != nil {
				require.NoError(t, err)
			}
			dec = codec.NewDecoderBytes(b, &codec.MsgpackHandle{WriteExt: true})
			if err := dec.Decode(&header); err != nil {
				require.NoError(t, err)
			}

			require.Equal(t, majorVersionExpected, header.Version.Major, "passed saltpack version %d (attached: %t) and expected major version %d, found %d", versionFlag, isAttached, majorVersionExpected, header.Version.Major)
		}
	}

	// 0 means the default, which is major version 2.
	run(0, 2)
	run(1, 1)
	run(2, 2)
}

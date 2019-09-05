// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"strings"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/saltpackkeystest"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/saltpack"
	"github.com/stretchr/testify/require"
)

type fakeSaltpackUI2 struct {
	DidDecrypt bool
	LastSender keybase1.SaltpackSender
}

func (s *fakeSaltpackUI2) SaltpackPromptForDecrypt(_ context.Context, arg keybase1.SaltpackPromptForDecryptArg, usedDelegateUI bool) (err error) {
	s.DidDecrypt = true
	s.LastSender = arg.Sender
	return nil
}

func (s *fakeSaltpackUI2) SaltpackVerifySuccess(_ context.Context, arg keybase1.SaltpackVerifySuccessArg) error {
	return nil
}

func (s *fakeSaltpackUI2) SaltpackVerifyBadSender(_ context.Context, arg keybase1.SaltpackVerifyBadSenderArg) error {
	return fmt.Errorf("fakeSaltpackUI2 SaltpackVerifyBadSender error: %s", arg.Sender.SenderType.String())
}

func TestSaltpackEncrypt(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackEncrypt")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "nalcp")
	u2 := CreateAndSignupFakeUser(tc, "nalcp")
	u3 := CreateAndSignupFakeUser(tc, "nalcp")

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}

	run := func(Recips []string) {
		sink := libkb.NewBufferCloser()
		arg := &SaltpackEncryptArg{
			Opts: keybase1.SaltpackEncryptOptions{
				Recipients:    Recips,
				UseEntityKeys: true,
			},
			Source: strings.NewReader("id2 and encrypt, id2 and encrypt"),
			Sink:   sink,
		}

		eng := NewSaltpackEncrypt(arg, NewSaltpackUserKeyfinderAsInterface)
		m := NewMetaContextForTest(tc).WithUIs(uis)
		if err := RunEngine2(m, eng); err != nil {
			t.Fatal(err)
		}

		out := sink.Bytes()
		if len(out) == 0 {
			t.Fatal("no output")
		}
	}
	run([]string{u1.Username, u2.Username})

	// If we add ourselves, we should be smart and not error out
	// (We are u3 in this case)
	run([]string{u1.Username, u2.Username, u3.Username})
}

// This is now the default behavior. Still good to test it though. Note that
// this flag is only meaningful in repudiable mode.
func TestSaltpackEncryptHideRecipients(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackEncrypt")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "nalcp")
	u2 := CreateAndSignupFakeUser(tc, "nalcp")
	u3 := CreateAndSignupFakeUser(tc, "nalcp")

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}

	run := func(Recips []string) {
		sink := libkb.NewBufferCloser()
		arg := &SaltpackEncryptArg{
			Opts: keybase1.SaltpackEncryptOptions{
				UseEntityKeys: true,
				// There used to be a HideRecipients flag here, but this is now
				// the default for encryption.
				// (It's not really meaningful for signcryption mode, where the
				// recipients are always opaque.)
				AuthenticityType: keybase1.AuthenticityType_REPUDIABLE,
				Recipients:       Recips,
				Binary:           true,
			},
			Source: strings.NewReader("id2 and encrypt, id2 and encrypt"),
			Sink:   sink,
		}

		eng := NewSaltpackEncrypt(arg, NewSaltpackUserKeyfinderAsInterface)
		m := NewMetaContextForTest(tc).WithUIs(uis)
		if err := RunEngine2(m, eng); err != nil {
			t.Fatal(err)
		}

		out := sink.Bytes()
		if len(out) == 0 {
			t.Fatal("no output")
		}

		var header saltpack.EncryptionHeader
		dec := codec.NewDecoderBytes(out, &codec.MsgpackHandle{WriteExt: true})
		var b []byte
		if err := dec.Decode(&b); err != nil {
			t.Fatal(err)
		}
		dec = codec.NewDecoderBytes(b, &codec.MsgpackHandle{WriteExt: true})
		if err := dec.Decode(&header); err != nil {
			t.Fatal(err)
		}

		for _, receiver := range header.Receivers {
			if receiver.ReceiverKID != nil {
				t.Fatal("receiver KID included in anonymous saltpack header")
			}
		}

	}
	run([]string{u1.Username, u2.Username})

	// If we add ourselves, we should be smart and not error out
	// (We are u3 in this case)
	run([]string{u1.Username, u2.Username, u3.Username})
}

func TestSaltpackEncryptAnonymousSigncryption(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackEncrypt")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "nalcp")
	u2 := CreateAndSignupFakeUser(tc, "nalcp")
	u3 := CreateAndSignupFakeUser(tc, "nalcp")

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	saltpackUI := &fakeSaltpackUI2{}
	uis := libkb.UIs{
		IdentifyUI: trackUI,
		SecretUI:   u3.NewSecretUI(),
		SaltpackUI: saltpackUI,
	}

	run := func(Recips []string) {
		encsink := libkb.NewBufferCloser()
		encarg := &SaltpackEncryptArg{
			Opts: keybase1.SaltpackEncryptOptions{
				UseEntityKeys:    true,
				Recipients:       Recips,
				AuthenticityType: keybase1.AuthenticityType_ANONYMOUS,
				Binary:           true,
				// HERE! This is what we're testing. (Signcryption mode is the
				// default. EncryptionOnlyMode is false.)
			},
			Source: strings.NewReader("id2 and encrypt, id2 and encrypt"),
			Sink:   encsink,
		}

		enceng := NewSaltpackEncrypt(encarg, NewSaltpackUserKeyfinderAsInterface)
		m := NewMetaContextForTest(tc).WithUIs(uis)
		if err := RunEngine2(m, enceng); err != nil {
			t.Fatal(err)
		}

		encout := encsink.Bytes()
		if len(encout) == 0 {
			t.Fatal("no output")
		}

		// Decode the header.
		var header saltpack.EncryptionHeader
		hdec := codec.NewDecoderBytes(encout, &codec.MsgpackHandle{WriteExt: true})
		var hbytes []byte
		if err := hdec.Decode(&hbytes); err != nil {
			t.Fatal(err)
		}
		hdec = codec.NewDecoderBytes(hbytes, &codec.MsgpackHandle{WriteExt: true})
		if err := hdec.Decode(&header); err != nil {
			t.Fatal(err)
		}

		// Necessary so that PUKs are used for decryption
		initPerUserKeyringInTestContext(t, tc)

		decsink := libkb.NewBufferCloser()
		decarg := &SaltpackDecryptArg{
			Source: strings.NewReader(encsink.String()),
			Sink:   decsink,
		}
		deceng := NewSaltpackDecrypt(decarg, saltpackkeystest.NewMockPseudonymResolver(t))
		if err := RunEngine2(m, deceng); err != nil {
			t.Fatal(err)
		}

		if !saltpackUI.DidDecrypt {
			t.Fatal("fake saltpackUI not called")
		}

		// The message should not contain the sender's public key (in the sender secretbox).
		// Instead, the sender key should be the ephemeral key.
		// This tests that the sender type is anonymous.
		if saltpackUI.LastSender.SenderType != keybase1.SaltpackSenderType_ANONYMOUS {
			t.Fatal("sender type not anonymous:", saltpackUI.LastSender.SenderType)
		}
	}

	run([]string{u1.Username, u2.Username})

	// If we add ourselves, we should be smart and not error out
	// (We are u3 in this case)
	run([]string{u1.Username, u2.Username, u3.Username})
}

func TestSaltpackEncryptSelfNoKey(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackEncrypt")
	defer tc.Cleanup()

	_, passphrase := createFakeUserWithNoKeys(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: &libkb.TestSecretUI{Passphrase: passphrase}}

	sink := libkb.NewBufferCloser()
	arg := &SaltpackEncryptArg{
		Opts: keybase1.SaltpackEncryptOptions{
			// Note: these users actually exist, but they do not have PUKs
			Recipients:    []string{"t_tracy+t_tracy@rooter", "t_george", "t_kb+gbrltest@twitter"},
			UseDeviceKeys: true,
		},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
	}

	eng := NewSaltpackEncrypt(arg, NewSaltpackUserKeyfinderAsInterface)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	if _, ok := err.(libkb.NoDeviceError); !ok {
		t.Fatalf("expected error type libkb.NoDeviceError, got %T (%s)", err, err)
	}
}

func TestSaltpackEncryptLoggedOut(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackEncrypt")
	defer tc.Cleanup()

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: &libkb.TestSecretUI{}}

	sink := libkb.NewBufferCloser()
	arg := &SaltpackEncryptArg{
		Opts: keybase1.SaltpackEncryptOptions{
			// Note: these users actually exist, but they do not have PUKs
			Recipients:    []string{"t_tracy+t_tracy@rooter", "t_george", "t_kb+gbrltest@twitter"},
			UseDeviceKeys: true,
			// Only anonymous mode works when you're logged out.
			AuthenticityType: keybase1.AuthenticityType_ANONYMOUS,
			NoSelfEncrypt:    true,
		},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
	}

	eng := NewSaltpackEncrypt(arg, NewSaltpackUserKeyfinderAsInterface)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	if err != nil {
		t.Fatalf("Got unexpected error: %s", err)
	}
}

func TestSaltpackEncryptNoNaclOnlyPGP(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackEncrypt")
	defer tc.Cleanup()

	u2 := createFakeUserWithPGPOnly(t, tc)
	Logout(tc)
	u1 := CreateAndSignupFakeUser(tc, "nalcp")

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{
		IdentifyUI: trackUI,
		SecretUI:   u1.NewSecretUI(),
		SaltpackUI: &fakeSaltpackUI{},
	}

	msg := "this will never work"
	sink := libkb.NewBufferCloser()
	arg := &SaltpackEncryptArg{
		Opts: keybase1.SaltpackEncryptOptions{
			Recipients:    []string{u2.Username},
			NoSelfEncrypt: true,
			UseDeviceKeys: true,
		},
		Source: strings.NewReader(msg),
		Sink:   sink,
	}

	eng := NewSaltpackEncrypt(arg, NewSaltpackUserKeyfinderAsInterface)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	if perr, ok := err.(libkb.NoNaClEncryptionKeyError); !ok {
		t.Fatalf("Got wrong error type: %T %v", err, err)
	} else if !perr.HasPGPKey {
		t.Fatalf("Should have a PGP key")
	} else if perr.Username != u2.Username {
		t.Fatalf("Wrong username")
	}
}

func TestSaltpackEncryptNoSelf(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackEncrypt")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "nalcp")
	u2 := CreateAndSignupFakeUser(tc, "nalcp")

	msg := "for your eyes only (not even mine!)"

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{
		IdentifyUI: trackUI,
		SecretUI:   u2.NewSecretUI(),
		SaltpackUI: &fakeSaltpackUI{},
	}

	sink := libkb.NewBufferCloser()
	arg := &SaltpackEncryptArg{
		Opts: keybase1.SaltpackEncryptOptions{
			Recipients:    []string{u1.Username},
			NoSelfEncrypt: true,
			UseDeviceKeys: true,
		},
		Source: strings.NewReader(msg),
		Sink:   sink,
	}

	eng := NewSaltpackEncrypt(arg, NewSaltpackUserKeyfinderAsInterface)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	out := sink.Bytes()
	if len(out) == 0 {
		t.Fatal("no output")
	}

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &SaltpackDecryptArg{
		Source: strings.NewReader(string(out)),
		Sink:   decoded,
	}
	dec := NewSaltpackDecrypt(decarg, saltpackkeystest.NewMockPseudonymResolver(t))
	err := RunEngine2(m, dec)

	decErr, ok := err.(libkb.DecryptionError)
	if !ok {
		t.Fatalf("Expected err type %T, but got %T", libkb.DecryptionError{}, err)
	}
	if _, ok = decErr.Cause.(libkb.NoDecryptionKeyError); !ok {
		t.Fatalf("Expected err Cause of type %T, but got %T", libkb.NoDecryptionKeyError{}, decErr.Cause)
	}

	Logout(tc)
	err = u1.Login(tc.G)
	require.NoError(t, err)

	m = m.WithSecretUI(u1.NewSecretUI())
	decarg.Source = strings.NewReader(string(out))
	dec = NewSaltpackDecrypt(decarg, saltpackkeystest.NewMockPseudonymResolver(t))
	err = RunEngine2(m, dec)
	if err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	if decmsg != msg {
		t.Errorf("decoded: %s, expected: %s", decmsg, msg)
	}
}

func TestSaltpackEncryptBinary(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackEncryptBinary")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "enc")

	// encrypt a message
	msg := "10 days in Japan"
	sink := libkb.NewBufferCloser()
	uis := libkb.UIs{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   fu.NewSecretUI(),
		LogUI:      tc.G.UI.GetLogUI(),
		SaltpackUI: &fakeSaltpackUI{},
	}
	// Should encrypt for self, too.
	arg := &SaltpackEncryptArg{
		Source: strings.NewReader(msg),
		Sink:   sink,
		Opts: keybase1.SaltpackEncryptOptions{
			Binary:        true,
			UseEntityKeys: true,
		},
	}
	enc := NewSaltpackEncrypt(arg, NewSaltpackUserKeyfinderAsInterface)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, enc); err != nil {
		t.Fatal(err)
	}
	out := sink.String()

	// Necessary so that PUKs are used for decryption
	initPerUserKeyringInTestContext(t, tc)

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	dec := NewSaltpackDecrypt(decarg, saltpackkeystest.NewMockPseudonymResolver(t))
	if err := RunEngine2(m, dec); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	if decmsg != msg {
		t.Errorf("decoded: %s, expected: %s", decmsg, msg)
	}
}

func TestSaltpackEncryptForceVersion(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackEncrypt")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "nalcp")

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u1.NewSecretUI()}

	run := func(versionFlag int, majorVersionExpected int) {
		sink := libkb.NewBufferCloser()
		arg := &SaltpackEncryptArg{
			Opts: keybase1.SaltpackEncryptOptions{
				// Encryption only mode is required to set version 1.
				AuthenticityType: keybase1.AuthenticityType_REPUDIABLE,
				Recipients:       []string{u1.Username},
				Binary:           true,
				SaltpackVersion:  versionFlag, // This is what we're testing!
				UseEntityKeys:    true,
			},
			Source: strings.NewReader("testing version flag"),
			Sink:   sink,
		}

		eng := NewSaltpackEncrypt(arg, NewSaltpackUserKeyfinderAsInterface)
		m := NewMetaContextForTest(tc).WithUIs(uis)
		if err := RunEngine2(m, eng); err != nil {
			t.Fatal(err)
		}

		out := sink.Bytes()
		if len(out) == 0 {
			t.Fatal("no output")
		}

		var header saltpack.EncryptionHeader
		dec := codec.NewDecoderBytes(out, &codec.MsgpackHandle{WriteExt: true})
		var b []byte
		if err := dec.Decode(&b); err != nil {
			t.Fatal(err)
		}
		dec = codec.NewDecoderBytes(b, &codec.MsgpackHandle{WriteExt: true})
		if err := dec.Decode(&header); err != nil {
			t.Fatal(err)
		}

		if header.Version.Major != majorVersionExpected {
			t.Fatalf("passed saltpack version %d and expected major version %d, found %d", versionFlag, majorVersionExpected, header.Version.Major)
		}
	}

	// 0 means the default, which is major version 2.
	run(0, 2)
	run(1, 1)
	run(2, 2)
}

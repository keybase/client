// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/saltpack"
)

func TestSaltpackEncrypt(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackEncrypt")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "nalcp")
	u2 := CreateAndSignupFakeUser(tc, "nalcp")
	u3 := CreateAndSignupFakeUser(tc, "nalcp")

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}

	run := func(Recips []string) {
		sink := libkb.NewBufferCloser()
		arg := &SaltpackEncryptArg{
			Opts:   keybase1.SaltpackEncryptOptions{Recipients: Recips},
			Source: strings.NewReader("id2 and encrypt, id2 and encrypt"),
			Sink:   sink,
		}

		eng := NewSaltpackEncrypt(arg, tc.G)
		if err := RunEngine(eng, ctx); err != nil {
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

func TestSaltpackEncryptHideRecipients(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackEncrypt")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "nalcp")
	u2 := CreateAndSignupFakeUser(tc, "nalcp")
	u3 := CreateAndSignupFakeUser(tc, "nalcp")

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}

	run := func(Recips []string) {
		sink := libkb.NewBufferCloser()
		arg := &SaltpackEncryptArg{
			Opts: keybase1.SaltpackEncryptOptions{
				Recipients:     Recips,
				HideRecipients: true,
				Binary:         true,
			},
			Source: strings.NewReader("id2 and encrypt, id2 and encrypt"),
			Sink:   sink,
		}

		eng := NewSaltpackEncrypt(arg, tc.G)
		if err := RunEngine(eng, ctx); err != nil {
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

func TestSaltpackEncryptSelfNoKey(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackEncrypt")
	defer tc.Cleanup()

	_, passphrase := createFakeUserWithNoKeys(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: &libkb.TestSecretUI{Passphrase: passphrase}}

	sink := libkb.NewBufferCloser()
	arg := &SaltpackEncryptArg{
		Opts: keybase1.SaltpackEncryptOptions{
			Recipients: []string{"t_tracy+t_tracy@rooter", "t_george", "t_kb+gbrltest@twitter"},
		},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
	}

	eng := NewSaltpackEncrypt(arg, tc.G)
	err := RunEngine(eng, ctx)
	if _, ok := err.(libkb.NoKeyError); !ok {
		t.Fatalf("expected error type libkb.NoKeyError, got %T (%s)", err, err)
	}
}

func TestSaltpackEncryptLoggedOut(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackEncrypt")
	defer tc.Cleanup()

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: &libkb.TestSecretUI{}}

	sink := libkb.NewBufferCloser()
	arg := &SaltpackEncryptArg{
		Opts: keybase1.SaltpackEncryptOptions{
			Recipients: []string{"t_tracy+t_tracy@rooter", "t_george", "t_kb+gbrltest@twitter"},
		},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
	}

	eng := NewSaltpackEncrypt(arg, tc.G)
	err := RunEngine(eng, ctx)
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
	ctx := &Context{
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
		},
		Source: strings.NewReader(msg),
		Sink:   sink,
	}

	eng := NewSaltpackEncrypt(arg, tc.G)
	err := RunEngine(eng, ctx)
	if perr, ok := err.(libkb.NoNaClEncryptionKeyError); !ok {
		t.Fatalf("Got wrong error type: %T %v", err, err)
	} else if !perr.HasPGPKey {
		t.Fatalf("Should have a PGP key")
	} else if perr.User != u2.Username {
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
	ctx := &Context{
		IdentifyUI: trackUI,
		SecretUI:   u2.NewSecretUI(),
		SaltpackUI: &fakeSaltpackUI{},
	}

	sink := libkb.NewBufferCloser()
	arg := &SaltpackEncryptArg{
		Opts: keybase1.SaltpackEncryptOptions{
			Recipients:    []string{u1.Username},
			NoSelfEncrypt: true,
		},
		Source: strings.NewReader(msg),
		Sink:   sink,
	}

	eng := NewSaltpackEncrypt(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
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
	dec := NewSaltpackDecrypt(decarg, tc.G)
	err := RunEngine(dec, ctx)
	if _, ok := err.(libkb.NoDecryptionKeyError); !ok {
		t.Fatalf("Expected err type %T, but got %T", libkb.NoDecryptionKeyError{}, err)
	}

	Logout(tc)
	u1.Login(tc.G)

	ctx.SecretUI = u1.NewSecretUI()
	decarg.Source = strings.NewReader(string(out))
	dec = NewSaltpackDecrypt(decarg, tc.G)
	err = RunEngine(dec, ctx)
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
	ctx := &Context{
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
			Binary: true,
		},
	}
	enc := NewSaltpackEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.String()

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	dec := NewSaltpackDecrypt(decarg, tc.G)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	if decmsg != msg {
		t.Errorf("decoded: %s, expected: %s", decmsg, msg)
	}
}

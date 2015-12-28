// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	saltpack "github.com/keybase/client/go/saltpack"
	"strings"
	"testing"
)

func TestSaltPackEncrypt(t *testing.T) {
	tc := SetupEngineTest(t, "SaltPackEncrypt")
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
		arg := &SaltPackEncryptArg{
			Opts:   keybase1.SaltPackEncryptOptions{Recipients: Recips},
			Source: strings.NewReader("id2 and encrypt, id2 and encrypt"),
			Sink:   sink,
		}

		eng := NewSaltPackEncrypt(arg, tc.G)
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

func TestSaltPackEncryptSelfNoKey(t *testing.T) {
	tc := SetupEngineTest(t, "SaltPackEncrypt")
	defer tc.Cleanup()

	_, passphrase := createFakeUserWithNoKeys(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: &libkb.TestSecretUI{Passphrase: passphrase}}

	sink := libkb.NewBufferCloser()
	arg := &SaltPackEncryptArg{
		Opts: keybase1.SaltPackEncryptOptions{
			Recipients: []string{"t_tracy+t_tracy@rooter", "t_george", "t_kb+gbrltest@twitter"},
		},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
	}

	eng := NewSaltPackEncrypt(arg, tc.G)
	err := RunEngine(eng, ctx)
	if _, ok := err.(libkb.NoKeyError); !ok {
		t.Fatalf("expected error type libkb.NoKeyError, got %T (%s)", err, err)
	}
}

func TestSaltPackEncryptLoggedOut(t *testing.T) {
	tc := SetupEngineTest(t, "SaltPackEncrypt")
	defer tc.Cleanup()

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI}

	sink := libkb.NewBufferCloser()
	arg := &SaltPackEncryptArg{
		Opts: keybase1.SaltPackEncryptOptions{
			Recipients: []string{"t_tracy+t_tracy@rooter", "t_george", "t_kb+gbrltest@twitter"},
		},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
	}

	eng := NewSaltPackEncrypt(arg, tc.G)
	err := RunEngine(eng, ctx)
	if err != nil {
		t.Fatalf("Got unexpected error: %s", err)
	}
}

func TestSaltPackEncryptNoSelf(t *testing.T) {
	tc := SetupEngineTest(t, "SaltPackEncrypt")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "nalcp")
	u2 := CreateAndSignupFakeUser(tc, "nalcp")

	msg := "for your eyes only (not even mine!)"

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u2.NewSecretUI()}

	sink := libkb.NewBufferCloser()
	arg := &SaltPackEncryptArg{
		Opts: keybase1.SaltPackEncryptOptions{
			Recipients:    []string{u1.Username},
			NoSelfEncrypt: true,
		},
		Source: strings.NewReader(msg),
		Sink:   sink,
	}

	eng := NewSaltPackEncrypt(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	out := sink.Bytes()
	if len(out) == 0 {
		t.Fatal("no output")
	}

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &SaltPackDecryptArg{
		Source: strings.NewReader(string(out)),
		Sink:   decoded,
	}
	dec := NewSaltPackDecrypt(decarg, tc.G)
	err := RunEngine(dec, ctx)
	if err != saltpack.ErrNoDecryptionKey {
		t.Fatalf("Expected err=%v, but got %v", saltpack.ErrNoDecryptionKey, err)
	}

	Logout(tc)
	u1.Login(tc.G)

	ctx = &Context{IdentifyUI: trackUI, SecretUI: u1.NewSecretUI()}
	decarg.Source = strings.NewReader(string(out))
	dec = NewSaltPackDecrypt(decarg, tc.G)
	err = RunEngine(dec, ctx)
	if err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	if decmsg != msg {
		t.Errorf("decoded: %s, expected: %s", decmsg, msg)
	}
}

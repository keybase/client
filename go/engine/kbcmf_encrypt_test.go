// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
)

func TestKBCMFEncrypt(t *testing.T) {
	tc := SetupEngineTest(t, "KBCMFEncrypt")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "kbcmf")
	u2 := CreateAndSignupFakeUser(tc, "kbcmf")
	u3 := CreateAndSignupFakeUser(tc, "kbcmf")

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}

	sink := libkb.NewBufferCloser()
	arg := &KBCMFEncryptArg{
		Recips: []string{u1.Username, u2.Username, u3.Username},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
		TrackOptions: keybase1.TrackOptions{
			BypassConfirm: true,
		},
	}

	eng := NewKBCMFEncrypt(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	out := sink.Bytes()
	if len(out) == 0 {
		t.Fatal("no output")
	}
}

func TestKBCMFEncryptSelfNoKey(t *testing.T) {
	tc := SetupEngineTest(t, "KBCMFEncrypt")
	defer tc.Cleanup()

	_, passphrase := createFakeUserWithNoKeys(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: &libkb.TestSecretUI{Passphrase: passphrase}}

	sink := libkb.NewBufferCloser()
	arg := &KBCMFEncryptArg{
		Recips: []string{"t_alice", "t_bob+kbtester1@twitter", "t_charlie+tacovontaco@twitter"},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
	}

	eng := NewKBCMFEncrypt(arg, tc.G)
	err := RunEngine(eng, ctx)
	if _, ok := err.(libkb.NoKeyError); !ok {
		t.Fatalf("expected error type libkb.NoKeyError, got %T (%s)", err, err)
	}
}

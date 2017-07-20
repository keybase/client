// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestPGPEncrypt(t *testing.T) {
	tc := SetupEngineTest(t, "PGPEncrypt")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkey(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u.NewSecretUI()}

	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips: []string{"t_alice", "t_bob+kbtester1@twitter", "t_charlie+tacovontaco@twitter"},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
		NoSign: true,
		BypassConfirm: true,
	}

	eng := NewPGPEncrypt(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	out := sink.Bytes()
	if len(out) == 0 {
		t.Fatal("no output")
	}
}

func TestPGPEncryptNoPGPNaClOnly(t *testing.T) {
	tc := SetupEngineTest(t, "TestPGPEncryptNoPGPNaClOnly")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "nalcp")
	Logout(tc)
	u2 := createFakeUserWithPGPSibkey(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u2.NewSecretUI()}

	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips: []string{u1.Username},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
		NoSign: true,
		BypassConfirm: true,
	}

	eng := NewPGPEncrypt(arg, tc.G)
	err := RunEngine(eng, ctx)
	if perr, ok := err.(libkb.NoPGPEncryptionKeyError); !ok {
		t.Fatalf("Got wrong error type: %T %v", err, err)
	} else if !perr.HasDeviceKey {
		t.Fatalf("Should have a PGP key")
	} else if perr.User != u1.Username {
		t.Fatalf("Wrong username")
	}
}

func TestPGPEncryptSelfNoKey(t *testing.T) {
	tc := SetupEngineTest(t, "PGPEncrypt")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u.NewSecretUI()}

	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips: []string{"t_alice", "t_bob+twitter:kbtester1", "t_charlie+twitter:tacovontaco"},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
		NoSign: true,
		BypassConfirm: true,
	}

	eng := NewPGPEncrypt(arg, tc.G)
	err := RunEngine(eng, ctx)
	if err == nil {
		t.Fatal("no error encrypting for self without pgp key")
	}
	if _, ok := err.(libkb.NoKeyError); !ok {
		t.Fatalf("expected error type libkb.NoKeyError, got %T (%s)", err, err)
	}
}

func TestPGPEncryptNoTrack(t *testing.T) {
	tc := SetupEngineTest(t, "PGPEncrypt")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkey(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
		FakeConfirmResult: &keybase1.ConfirmResult {
			IdentityConfirmed: true,
			RemoteConfirmed: false,
		},
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u.NewSecretUI()}

	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips: []string{"t_alice", "t_bob+kbtester1@twitter", "t_charlie+tacovontaco@twitter"},
		Source: strings.NewReader("identify and encrypt, identify and encrypt"),
		Sink:   sink,
		NoSign: true,
	}

	eng := NewPGPEncrypt(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	out := sink.Bytes()
	if len(out) == 0 {
		t.Fatal("no output")
	}

	assertNotTracking(tc, "t_alice")
	assertNotTracking(tc, "t_bob")
	assertNotTracking(tc, "t_charlie")
}

// encrypt for self via NoSelf: false and username in recipients
func TestPGPEncryptSelfTwice(t *testing.T) {
	tc := SetupEngineTest(t, "PGPEncrypt")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkey(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u.NewSecretUI()}

	msg := "encrypt for self only once"
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips: []string{u.Username},
		Source: strings.NewReader(msg),
		Sink:   sink,
		NoSign: true,
		BypassConfirm: true,
	}

	eng := NewPGPEncrypt(arg, tc.G)
	err := RunEngine(eng, ctx)
	if err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   decoded,
	}
	dec := NewPGPDecrypt(decarg, tc.G)
	ctx.LogUI = tc.G.UI.GetLogUI()
	ctx.PgpUI = &TestPgpUI{}
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}

	recips := dec.signStatus.RecipientKeyIDs
	if len(recips) != 1 {
		t.Logf("recipient key ids: %v", recips)
		t.Errorf("num recipient key ids: %d, expected 1", len(recips))
	}
}

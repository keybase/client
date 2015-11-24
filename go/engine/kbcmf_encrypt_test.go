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

	u := CreateAndSignupFakeUser(tc, "kbcmf")
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u.NewSecretUI()}

	sink := libkb.NewBufferCloser()
	arg := &KBCMFEncryptArg{
		Recips: []string{"t_alice", "t_bob+kbtester1@twitter", "t_charlie+tacovontaco@twitter"},
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

/*
func TestKBCMFEncryptSelfNoKey(t *testing.T) {
	tc := SetupEngineTest(t, "KBCMFEncrypt")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u.NewSecretUI()}

	sink := libkb.NewBufferCloser()
	arg := &KBCMFEncryptArg{
		Recips: []string{"t_alice", "t_bob+kbtester1@twitter", "t_charlie+tacovontaco@twitter"},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
		NoSign: true,
	}

	eng := NewKBCMFEncrypt(arg, tc.G)
	err := RunEngine(eng, ctx)
	if err == nil {
		t.Fatal("no error encrypting for self without kbcmf key")
	}
	if _, ok := err.(libkb.NoKeyError); !ok {
		t.Fatalf("expected error type libkb.NoKeyError, got %T (%s)", err, err)
	}
}

func TestKBCMFEncryptNoTrack(t *testing.T) {
	tc := SetupEngineTest(t, "KBCMFEncrypt")
	defer tc.Cleanup()

	u := createFakeUserWithKBCMFSibkey(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u.NewSecretUI()}

	sink := libkb.NewBufferCloser()
	arg := &KBCMFEncryptArg{
		Recips: []string{"t_alice", "t_bob+kbtester1@twitter", "t_charlie+tacovontaco@twitter"},
		Source: strings.NewReader("identify and encrypt, identify and encrypt"),
		Sink:   sink,
		NoSign: true,
	}

	eng := NewKBCMFEncrypt(arg, tc.G)
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
func TestKBCMFEncryptSelfTwice(t *testing.T) {
	tc := SetupEngineTest(t, "KBCMFEncrypt")
	defer tc.Cleanup()

	u := createFakeUserWithKBCMFSibkey(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u.NewSecretUI()}

	msg := "encrypt for self only once"
	sink := libkb.NewBufferCloser()
	arg := &KBCMFEncryptArg{
		Recips: []string{u.Username},
		Source: strings.NewReader(msg),
		Sink:   sink,
		NoSign: true,
	}

	eng := NewKBCMFEncrypt(arg, tc.G)
	err := RunEngine(eng, ctx)
	if err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &KBCMFDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   decoded,
	}
	dec := NewKBCMFDecrypt(decarg, tc.G)
	ctx.LogUI = tc.G.UI.GetLogUI()
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
*/

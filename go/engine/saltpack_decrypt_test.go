// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
	"strings"
	"testing"
)

type fakeSaltPackUI struct{}

func (s fakeSaltPackUI) SaltPackPromptForDecrypt(_ context.Context, arg keybase1.SaltPackPromptForDecryptArg) (err error) {
	return nil
}

func TestSaltPackDecrypt(t *testing.T) {
	tc := SetupEngineTest(t, "SaltPackDecrypt")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "naclp")

	// encrypt a message
	msg := "10 days in Japan"
	sink := libkb.NewBufferCloser()
	ctx := &Context{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   fu.NewSecretUI(),
		LogUI:      tc.G.UI.GetLogUI(),
		SaltPackUI: &fakeSaltPackUI{},
	}
	// Should encrypt for self, too.
	arg := &SaltPackEncryptArg{
		Source: strings.NewReader(msg),
		Sink:   sink,
	}
	enc := NewSaltPackEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.String()

	t.Logf("encrypted data: %s", out)

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &SaltPackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	dec := NewSaltPackDecrypt(decarg, tc.G)
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	if decmsg != msg {
		t.Errorf("decoded: %s, expected: %s", decmsg, msg)
	}
}

type testDecryptSaltPackUI struct {
	f func(arg keybase1.SaltPackPromptForDecryptArg) error
}

func (t *testDecryptSaltPackUI) SaltPackPromptForDecrypt(_ context.Context, arg keybase1.SaltPackPromptForDecryptArg) (err error) {
	if t.f == nil {
		return nil
	}
	return t.f(arg)
}

func TestSaltPackDecryptBrokenTrack(t *testing.T) {

	tc := SetupEngineTest(t, "SaltPackDecrypt")
	defer tc.Cleanup()

	// create a user to track the proofUser
	trackUser := CreateAndSignupFakeUser(tc, "naclp")
	Logout(tc)

	// create a user with a rooter proof
	proofUser := CreateAndSignupFakeUser(tc, "naclp")
	ui, _, err := proveRooter(tc.G, proofUser)
	if err != nil {
		t.Fatal(err)
	}

	spui := testDecryptSaltPackUI{}

	// encrypt a message
	msg := "10 days in Japan"
	sink := libkb.NewBufferCloser()
	ctx := &Context{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   proofUser.NewSecretUI(),
		LogUI:      tc.G.UI.GetLogUI(),
		SaltPackUI: &spui,
	}

	arg := &SaltPackEncryptArg{
		Source: strings.NewReader(msg),
		Sink:   sink,
		Opts: keybase1.SaltPackEncryptOptions{
			NoSelfEncrypt: true,
			Recipients: []string{
				trackUser.Username,
			},
		},
	}
	enc := NewSaltPackEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	out := sink.String()

	// Also output a hidden-sender message
	arg.Opts.HideSelf = true
	sink = libkb.NewBufferCloser()
	arg.Source = strings.NewReader(msg)
	arg.Sink = sink
	enc = NewSaltPackEncrypt(arg, tc.G)
	if err := RunEngine(enc, ctx); err != nil {
		t.Fatal(err)
	}
	outHidden := sink.String()

	Logout(tc)

	// Now login as the track user and track the proofUser
	trackUser.LoginOrBust(tc)
	rbl := sb{
		social:     true,
		id:         proofUser.Username + "@rooter",
		proofState: keybase1.ProofState_OK,
	}
	outcome := keybase1.IdentifyOutcome{
		NumProofSuccesses: 1,
		TrackStatus:       keybase1.TrackStatus_NEW_OK,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
	if err != nil {
		t.Fatal(err)
	}

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &SaltPackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	dec := NewSaltPackDecrypt(decarg, tc.G)
	spui.f = func(arg keybase1.SaltPackPromptForDecryptArg) error {
		if arg.Sender.SenderType != keybase1.SaltPackSenderType_TRACKING_OK {
			t.Fatalf("Bad sender type: %v", arg.Sender.SenderType)
		}
		return nil
	}
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	// Should work!
	if decmsg != msg {
		t.Fatalf("decoded: %s, expected: %s", decmsg, msg)
	}

	// now decrypt the hidden-self message
	decoded = libkb.NewBufferCloser()
	decarg = &SaltPackDecryptArg{
		Source: strings.NewReader(outHidden),
		Sink:   decoded,
	}
	dec = NewSaltPackDecrypt(decarg, tc.G)
	spui.f = func(arg keybase1.SaltPackPromptForDecryptArg) error {
		if arg.Sender.SenderType != keybase1.SaltPackSenderType_ANONYMOUS {
			t.Fatalf("Bad sender type: %v", arg.Sender.SenderType)
		}
		return nil
	}
	if err := RunEngine(dec, ctx); err != nil {
		t.Fatal(err)
	}
	decmsg = decoded.String()
	// Should work!
	if decmsg != msg {
		t.Fatalf("decoded: %s, expected: %s", decmsg, msg)
	}

	// remove the rooter proof to break the tracking statement
	Logout(tc)
	proofUser.LoginOrBust(tc)
	if err := proveRooterRemove(tc.G, ui.postID); err != nil {
		t.Fatal(err)
	}

	Logout(tc)

	// Decrypt the message and fail, since our tracking statement is now
	// broken.
	trackUser.LoginOrBust(tc)
	decoded = libkb.NewBufferCloser()
	decarg = &SaltPackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
		Opts: keybase1.SaltPackDecryptOptions{
			ForceRemoteCheck: true,
		},
	}
	dec = NewSaltPackDecrypt(decarg, tc.G)
	errTrackingBroke := errors.New("tracking broke")
	spui.f = func(arg keybase1.SaltPackPromptForDecryptArg) error {
		if arg.Sender.SenderType != keybase1.SaltPackSenderType_TRACKING_BROKE {
			t.Fatalf("Bad sender type: %v", arg.Sender.SenderType)
		}
		return errTrackingBroke
	}
	if err = RunEngine(dec, ctx); err != errTrackingBroke {
		t.Fatalf("Expected an error %v; but got %v", errTrackingBroke, err)
	}
}

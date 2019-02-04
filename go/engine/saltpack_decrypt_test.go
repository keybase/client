// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/saltpackkeystest"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type fakeSaltpackUI struct{}

func (s fakeSaltpackUI) SaltpackPromptForDecrypt(_ context.Context, arg keybase1.SaltpackPromptForDecryptArg, usedDelegateUI bool) (err error) {
	return nil
}

func (s fakeSaltpackUI) SaltpackVerifySuccess(_ context.Context, arg keybase1.SaltpackVerifySuccessArg) error {
	return nil
}

type FakeBadSenderError struct {
	senderType keybase1.SaltpackSenderType
}

func (e *FakeBadSenderError) Error() string {
	return fmt.Sprintf("fakeSaltpackUI bad sender error: %s", e.senderType.String())
}

func (s fakeSaltpackUI) SaltpackVerifyBadSender(_ context.Context, arg keybase1.SaltpackVerifyBadSenderArg) error {
	return &FakeBadSenderError{arg.Sender.SenderType}
}

func initPerUserKeyringInTestContext(t *testing.T, tc libkb.TestContext) {
	kr, err := tc.G.GetPerUserKeyring(context.Background())
	require.NoError(t, err)
	err = kr.Sync(libkb.NewMetaContext(context.Background(), tc.G))
	require.NoError(t, err)
}

func TestSaltpackDecrypt(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackDecrypt")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "naclp")

	initPerUserKeyringInTestContext(t, tc)

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
		Opts: keybase1.SaltpackEncryptOptions{
			UseEntityKeys: true,
		},
		Source: strings.NewReader(msg),
		Sink:   sink,
	}
	enc := NewSaltpackEncrypt(arg, NewSaltpackUserKeyfinderAsInterface)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, enc); err != nil {
		t.Fatal(err)
	}
	out := sink.String()

	t.Logf("encrypted data: %s", out)

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

	pgpMsg := `-----BEGIN PGP MESSAGE-----
Version: GnuPG v1

hQEMA5gKPw0B/gTfAQf+JacZcP+4d1cdmRV5qlrDUhK3qm5dtzAh8KE3z6OMSOmE
fUAdMZweHZMkWA5C1OZbvZ6SKaFLFHjmiD0DWlcdiXsvgPH9RpTHOSrxdjRlBuwK
JBz5OrDM/OStIam6jKcxBcrI43JkWOG64AOwJ4Rx3OjAnzbKJKeUCAaopbXc2M5O
iyTPzEsexRFjSfPGRk9cQD5zfar3Qjk2cRWElgABiQczWtfNAQ3NyQLzmRU6mw+i
ZLoViAwQm2BMYa2i6MYOJCQtxHLwZCtAbRXTGFZ2nP0gVVX50KIeL/rnzrQ4I05M
CljEVk3BBSQBl3jqecfT2Ooh+rwgf3VSQ684HIEt5dI/Aama8l7S3ypwVyt8gWhN
HTngZWUk8Tjn6Q8zrnnoB92G1G+rZHAiChgBFQCaYDBsWa0Pia6Vm+10OAIulGGj
=pNG+
-----END PGP MESSAGE-----
`
	decoded = libkb.NewBufferCloser()
	decarg = &SaltpackDecryptArg{
		Source: strings.NewReader(pgpMsg),
		Sink:   decoded,
	}
	dec = NewSaltpackDecrypt(decarg, saltpackkeystest.NewMockPseudonymResolver(t))
	err := RunEngine2(m, dec)
	if wse, ok := err.(libkb.WrongCryptoFormatError); !ok {
		t.Fatalf("Wanted a WrongCryptoFormat error, but got %T (%v)", err, err)
	} else if wse.Wanted != libkb.CryptoMessageFormatSaltpack ||
		wse.Received != libkb.CryptoMessageFormatPGP ||
		wse.Operation != "decrypt" {
		t.Fatalf("Bad error: %v", wse)
	}

}

type testDecryptSaltpackUI struct {
	fakeSaltpackUI
	f func(arg keybase1.SaltpackPromptForDecryptArg) error
}

func (t *testDecryptSaltpackUI) SaltpackPromptForDecrypt(_ context.Context, arg keybase1.SaltpackPromptForDecryptArg, usedDelegateUI bool) (err error) {
	if t.f == nil {
		return nil
	}
	return t.f(arg)
}

func TestSaltpackDecryptBrokenTrack(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackDecrypt")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)

	// create a user to track the proofUser
	trackUser := CreateAndSignupFakeUser(tc, "naclp")
	Logout(tc)

	// create a user with a rooter proof
	proofUser := CreateAndSignupFakeUser(tc, "naclp")
	ui, _, err := proveRooter(tc.G, proofUser, sigVersion)
	if err != nil {
		t.Fatal(err)
	}

	spui := testDecryptSaltpackUI{}

	// encrypt a message
	msg := "10 days in Japan"
	sink := libkb.NewBufferCloser()
	uis := libkb.UIs{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   proofUser.NewSecretUI(),
		LogUI:      tc.G.UI.GetLogUI(),
		SaltpackUI: &spui,
	}

	arg := &SaltpackEncryptArg{
		Source: strings.NewReader(msg),
		Sink:   sink,
		Opts: keybase1.SaltpackEncryptOptions{
			NoSelfEncrypt: true,
			UseEntityKeys: true,
			Recipients: []string{
				trackUser.Username,
			},
		},
	}
	enc := NewSaltpackEncrypt(arg, NewSaltpackUserKeyfinderAsInterface)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, enc); err != nil {
		t.Fatal(err)
	}
	out := sink.String()

	// Also output a anonymous-sender message
	arg.Opts.AuthenticityType = keybase1.AuthenticityType_ANONYMOUS
	sink = libkb.NewBufferCloser()
	arg.Source = strings.NewReader(msg)
	arg.Sink = sink
	enc = NewSaltpackEncrypt(arg, NewSaltpackUserKeyfinderAsInterface)
	if err := RunEngine2(m, enc); err != nil {
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
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome, sigVersion)
	if err != nil {
		t.Fatal(err)
	}

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	initPerUserKeyringInTestContext(t, tc)
	dec := NewSaltpackDecrypt(decarg, saltpackkeystest.NewMockPseudonymResolver(t))
	spui.f = func(arg keybase1.SaltpackPromptForDecryptArg) error {
		if arg.Sender.SenderType != keybase1.SaltpackSenderType_TRACKING_OK {
			t.Fatalf("Bad sender type: %v", arg.Sender.SenderType)
		}
		return nil
	}
	if err := RunEngine2(m, dec); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	// Should work!
	if decmsg != msg {
		t.Fatalf("decoded: %s, expected: %s", decmsg, msg)
	}

	// now decrypt the hidden-self message
	decoded = libkb.NewBufferCloser()
	decarg = &SaltpackDecryptArg{
		Source: strings.NewReader(outHidden),
		Sink:   decoded,
	}
	initPerUserKeyringInTestContext(t, tc)
	dec = NewSaltpackDecrypt(decarg, saltpackkeystest.NewMockPseudonymResolver(t))
	spui.f = func(arg keybase1.SaltpackPromptForDecryptArg) error {
		if arg.Sender.SenderType != keybase1.SaltpackSenderType_ANONYMOUS {
			t.Fatalf("Bad sender type: %v", arg.Sender.SenderType)
		}
		return nil
	}
	if err := RunEngine2(m, dec); err != nil {
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
	decarg = &SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
		Opts: keybase1.SaltpackDecryptOptions{
			ForceRemoteCheck: true,
		},
	}
	initPerUserKeyringInTestContext(t, tc)
	dec = NewSaltpackDecrypt(decarg, saltpackkeystest.NewMockPseudonymResolver(t))
	errTrackingBroke := errors.New("tracking broke")
	spui.f = func(arg keybase1.SaltpackPromptForDecryptArg) error {
		if arg.Sender.SenderType != keybase1.SaltpackSenderType_TRACKING_BROKE {
			t.Fatalf("Bad sender type: %v", arg.Sender.SenderType)
		}
		return errTrackingBroke
	}
	err = RunEngine2(m, dec)
	if decErr, ok := err.(libkb.DecryptionError); ok && decErr.Cause != errTrackingBroke {
		t.Fatalf("Expected an error %v; but got %v", errTrackingBroke, err)
	}
}

// The error info that this test is looking for is only available in legacy
// saltpack encryption (i.e. repudiable) mode messages (originally called
// encryption-only mode). Modern repudiable messages always have all-anonymous-recipients,
// and signcryption messages have opaque receivers.
func TestSaltpackNoEncryptionForDevice(t *testing.T) {
	// userX has one device (device X) and a paper key. userZ will encrypt a message for userX,
	// then userX will add a new device (Y) which should not be able to decrypt the message
	// (as we are not using PUKs) but will receive an helpful error message which tells them
	// which other devices to use to decrypt.

	// device X (provisioner) context:
	tcX := SetupEngineTest(t, "kex2provision")
	defer tcX.Cleanup()

	// device Z is the encryptor's device
	tcZ := SetupEngineTest(t, "encryptor")
	defer tcZ.Cleanup()

	// provisioner needs to be logged in
	userX := CreateAndSignupFakeUserPaper(tcX, "naclp")

	encryptor := CreateAndSignupFakeUser(tcZ, "naclp")
	spui := testDecryptSaltpackUI{}

	// encrypt a message with encryption / tcZ
	msg := "10 days in Japan"
	sink := libkb.NewBufferCloser()
	uis := libkb.UIs{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   encryptor.NewSecretUI(),
		LogUI:      tcZ.G.UI.GetLogUI(),
		SaltpackUI: &spui,
	}

	arg := &SaltpackEncryptArg{
		Source: strings.NewReader(msg),
		Sink:   sink,
		Opts: keybase1.SaltpackEncryptOptions{
			Recipients: []string{
				userX.Username,
			},
			UseDeviceKeys:    true,
			UsePaperKeys:     true,
			AuthenticityType: keybase1.AuthenticityType_REPUDIABLE,
		},
	}
	enc := NewSaltpackEncrypt(arg, NewSaltpackUserKeyfinderAsInterface)
	m := NewMetaContextForTest(tcZ).WithUIs(uis)
	// The error messages in this test only work for visible recipients, which
	// aren't the default anymore.
	enc.visibleRecipientsForTesting = true

	if err := RunEngine2(m, enc); err != nil {
		t.Fatal(err)
	}
	out := sink.String()

	// decrypt it with userX / tcX
	decoded := libkb.NewBufferCloser()
	decarg := &SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	dec := NewSaltpackDecrypt(decarg, saltpackkeystest.NewMockPseudonymResolver(t))
	spui.f = func(arg keybase1.SaltpackPromptForDecryptArg) error {
		if arg.Sender.SenderType != keybase1.SaltpackSenderType_NOT_TRACKED {
			t.Fatalf("Bad sender type: %v", arg.Sender.SenderType)
		}
		return nil
	}
	uis = libkb.UIs{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   userX.NewSecretUI(),
		LogUI:      tcX.G.UI.GetLogUI(),
		SaltpackUI: &spui,
	}
	m = NewMetaContextForTest(tcX).WithUIs(uis)
	if err := RunEngine2(m, dec); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	// Should work!
	if decmsg != msg {
		t.Fatalf("decoded: %s, expected: %s", decmsg, msg)
	}

	// Now make a new device for userX
	tcY, Cleanup := provisionNewDeviceKex(&tcX, userX)
	defer Cleanup()
	if err := AssertProvisioned(*tcY); err != nil {
		t.Fatal(err)
	}

	// Now try and fail to decrypt with device Y (via tcY)
	decoded = libkb.NewBufferCloser()
	decarg = &SaltpackDecryptArg{
		Source: strings.NewReader(out),
		Sink:   decoded,
	}
	dec = NewSaltpackDecrypt(decarg, saltpackkeystest.NewMockPseudonymResolver(t))
	spui.f = func(arg keybase1.SaltpackPromptForDecryptArg) error {
		t.Fatal("should not be prompted for decryption")
		return nil
	}
	uis = libkb.UIs{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   userX.NewSecretUI(),
		LogUI:      tcY.G.UI.GetLogUI(),
		SaltpackUI: &spui,
	}
	m = NewMetaContextForTest(*tcY).WithUIs(uis)
	if err := RunEngine2(m, dec); err == nil {
		t.Fatal("Should have seen a decryption error")
	}

	// Make sure we get the right helpful debug message back
	me := dec.MessageInfo()
	if len(me.Devices) != 2 {
		t.Fatalf("expected 2 valid devices; got %d", len(me.Devices))
	}

	backup := 0
	desktops := 0
	for _, d := range me.Devices {
		switch d.Type {
		case "backup":
			backup++
		case "desktop":
			desktops++
			if !userX.EncryptionKey.GetKID().Equal(d.EncryptKey) {
				t.Fatal("got wrong encryption key for good possibilities")
			}
		default:
			t.Fatalf("wrong kind of device: %s\n", d.Type)
		}
	}
	if backup != 1 {
		t.Fatal("Only wanted 1 backup key")
	}
	if desktops != 1 {
		t.Fatal("only wanted 1 desktop key")
	}
}

func TestSaltpackDecryptWithPaperKey(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackDecrypt")
	defer tc.Cleanup()

	// We don't log in as a test user here. This flow should work even if
	// you're totally logged out.

	msg := `BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE. kiPgBwdlv6bV9N8
	dSkCbjKrku4NADt gV8qC1k8zRA0Bi0 6KvGQoMyf99b2id uGZ3EDTqb5nZVPT
	vhMiB49BOHavdzN mySkmzwlSWDsuQA z9RIPfrIX9IJCfi yqlaD1HOqK1lilP
	tDrign5LrAB8zLz 4NwPFBwpQJWW8sO N9Jk6yzf6QvdPav GN9SqL6YX7XEbJc
	PLrDD7LCj7fHObD O3pTQSLjuUKqAqa 3LDiQEVEDUZzYLy TvKyMJ2U8gCuhcU
	SeqDClUNAPKqEEM MRgyTcw0LSwK4A5 YyZhDM065PA5SHb 6ZFPGYnv81HOibR
	FHHv5lYEqPqPAZa ETIXLblnxI61F2q 6cH3w60bbxFuQB2 fwLZQSUS4ZzyVSw
	UN3OKZMr79vqr6S ap3vMMqGiWm3blG ptjZEmFXI5dQqZG w9AO0Djmy2fWnCB
	Z42e7BZteGaRhz8 zVmNLdOvtWiJkRF FUo2KvUgBsk9ecJ 3iZUOhYbdqja2Xx
	osdOqu6OUS9V4XC H9vRylZJShvVg2X NLaeeHZ6AHdxkxO NgrG1NqHeIubq8p
	0VaDq1iKk78Qj27 4q26yqnt5E9sgnN xJ850oP5DeKWrN3 yaif8ouprlETzY3
	CLmDsAN5vVCgVga gx1q3YEjKUmJqD2 EsY5KBKogE1YjvQ eVaoqX5qiKtS6o0
	oGE70tbveveK0kV SErmRsOSFBieaCq JzW75TXRCHpLvVB 1ZB8Wih6cyvw1yx
	pK5RJNfPOF6lzKm i28FT9EoCw7uvsB kBG2EfA9YRkhXKh RoqAGrkdX3ziGy8
	j5eOK91eyIcl7f7 SfUFLzETW5ULZfm 7Z9BIeOJogk7a1B 7IUJQiYpLyG3xAF
	p3nmeSIalwfIzhV opNxUB7ltUOn3PX t9abJAZkUodMURG zXw0dKHQKtWXce6
	y8jHbaU0zLwxvhO W3bxHNGoQ10t7Gq hSPu7SYLYyD926w 8nv5FqiUtTf7eJq
	Ay1c2FAYMPkB4ay 6lB0wxtpNCGt8MO RtrC1Da3aj7rLTL fFNz2kxb78hT2Tu
	QNiHyBL. END KEYBASE SALTPACK ENCRYPTED MESSAGE.`

	paperkey := "fitness weasel session truly among connect explain found measure smile ask ball shoulder"

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &SaltpackDecryptArg{
		Source: strings.NewReader(msg),
		Sink:   decoded,
		Opts: keybase1.SaltpackDecryptOptions{
			UsePaperKey: true,
		},
	}
	dec := NewSaltpackDecrypt(decarg, saltpackkeystest.NewMockPseudonymResolver(t))
	uis := libkb.UIs{
		IdentifyUI: &FakeIdentifyUI{},
		// Here's where the paper key goes in!
		SecretUI:   &libkb.TestSecretUI{Passphrase: paperkey},
		LogUI:      tc.G.UI.GetLogUI(),
		SaltpackUI: &fakeSaltpackUI{},
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, dec); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.String()
	expected := "message for paper key"
	if decmsg != expected {
		t.Errorf("decoded: %s, expected: %s", decmsg, expected)
	}
}

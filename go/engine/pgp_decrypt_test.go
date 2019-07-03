// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"crypto/rand"
	"strings"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func decengctx(fu *FakeUser, tc libkb.TestContext) libkb.MetaContext {
	return NewMetaContextForTest(tc).WithUIs(libkb.UIs{
		IdentifyUI: &FakeIdentifyUI{},
		SecretUI:   fu.NewSecretUI(),
		LogUI:      tc.G.UI.GetLogUI(),
		PgpUI:      &TestPgpUI{},
	})
}

func TestPGPDecrypt(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPSibkeyPushed(tc)

	// encrypt a message
	msg := "10 days in Japan"
	sink := libkb.NewBufferCloser()
	ctx := decengctx(fu, tc)
	arg := &PGPEncryptArg{
		Source:       strings.NewReader(msg),
		Sink:         sink,
		NoSign:       true,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(tc.G, arg)
	if err := RunEngine2(ctx, enc); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   decoded,
	}
	dec := NewPGPDecrypt(tc.G, decarg)
	if err := RunEngine2(ctx, dec); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}

	if dec.Signer() != nil {
		t.Errorf("signer exists, but NoSign flag was true")
	}
}

func TestPGPDecryptArmored(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPSibkeyPushed(tc)

	// encrypt a message
	msg := "10 days in Japan"
	ctx := decengctx(fu, tc)
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Source: strings.NewReader(msg),
		Sink:   sink,
		NoSign: true,
	}
	enc := NewPGPEncrypt(tc.G, arg)
	if err := RunEngine2(ctx, enc); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   decoded,
	}
	dec := NewPGPDecrypt(tc.G, decarg)
	if err := RunEngine2(ctx, dec); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}

	// A saltpack message
	saltpack := `BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE.
	kiOUtMhcc4NXXRb XMxIeCbf5rGHq6R lPA7tN3yNXtviMm fQULSIc4k93xPgP ranhF1KYLsndSXH 5hK5WHvPJYOvN3G XLzn8MQ3Q5nwFfY K81cz83VtMGh4CC QnNDeIWVZawH75I jFf8SlDWsdj139W FeS69yb9b7Mo5fA rusOzT3JaydVWgf qC7hU3CUvYR65nP xUpmT2HdHPG5MQu XsOhrf5Zv39u9BB AOkyDAgD7hVSSl9 JQ3eYiduTli4Bqh Ri3uJyBayvkWZTF PSOdMhIbjCptBQ3 oTdvh6pOaUPQeoJ ENL1iuVK04KCOy9 xFekloWTI94hkgt gZakcYbimhmzhea Dsgl2mVqgIwmHgv hp5Indezz4TNtOh VJ8c4BBt1NEzIDg ZfFUiAALL0jRfrB cz7tQc1ussnYzrI IfHSFPDe9Cvz9lp gb1BBogunZOkoNW skfxofDP2lX3Qx7 QP5ah5zm8VV0iw1 zfQaNoxicwkqrM8 tfxyKUWZAypOKoF wUIaC1CQIkTZANa bIJyCxs9g6WceUE jLhh4PazAPCMOU9 M3zOBPP1ieDvc0M OzBLKtBWwz0J1nU 0wtMiADTMKMV.
	END KEYBASE SALTPACK ENCRYPTED MESSAGE.`

	decoded = libkb.NewBufferCloser()
	decarg = &PGPDecryptArg{
		Source: strings.NewReader(saltpack),
		Sink:   decoded,
	}
	dec = NewPGPDecrypt(tc.G, decarg)
	err := RunEngine2(ctx, dec)
	if wse, ok := err.(libkb.WrongCryptoFormatError); !ok {
		t.Fatalf("Wanted a WrongCryptoFormat error, but got %T (%v)", err, err)
	} else if wse.Wanted != libkb.CryptoMessageFormatPGP ||
		wse.Received != libkb.CryptoMessageFormatSaltpack ||
		wse.Operation != "decrypt" {
		t.Fatalf("Bad error: %v", wse)
	}
}

// TestPGPDecryptSignedSelf tests that the user who signed the
// message can decrypt it.
func TestPGPDecryptSignedSelf(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPSibkeyPushed(tc)

	// encrypt a message
	msg := "We pride ourselves on being meticulous; no issue is too small."
	ctx := decengctx(fu, tc)
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Source:       strings.NewReader(msg),
		Sink:         sink,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(tc.G, arg)
	if err := RunEngine2(ctx, enc); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source:       bytes.NewReader(out),
		Sink:         decoded,
		AssertSigned: true,
	}
	dec := NewPGPDecrypt(tc.G, decarg)
	if err := RunEngine2(ctx, dec); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}
}

// TestPGPDecryptSignedOther tests that a user who didn't sign the
// message can verify the signature.
func TestPGPDecryptSignedOther(t *testing.T) {
	tcRecipient := SetupEngineTest(t, "PGPDecrypt - Recipient")
	defer tcRecipient.Cleanup()
	recipient := createFakeUserWithPGPSibkey(tcRecipient)
	Logout(tcRecipient)

	tcSigner := SetupEngineTest(t, "PGPDecrypt - Signer")
	defer tcSigner.Cleanup()
	signer := createFakeUserWithPGPSibkey(tcSigner)

	// encrypt a message
	msg := "We pride ourselves on being meticulous; no issue is too small."
	ctx := decengctx(signer, tcSigner)
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips:       []string{recipient.Username},
		Source:       strings.NewReader(msg),
		Sink:         sink,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(tcSigner.G, arg)
	if err := RunEngine2(ctx, enc); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// signer logs out, recipient logs in:
	t.Logf("signer (%q) logging out", signer.Username)
	Logout(tcSigner)
	// G = libkb.G
	t.Logf("recipient (%q) logging in", recipient.Username)
	recipient.LoginOrBust(tcRecipient)

	rtrackUI := &FakeIdentifyUI{}
	uis := libkb.UIs{
		IdentifyUI: rtrackUI,
		SecretUI:   recipient.NewSecretUI(),
		LogUI:      tcRecipient.G.UI.GetLogUI(),
		PgpUI:      &TestPgpUI{},
	}

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source:       bytes.NewReader(out),
		Sink:         decoded,
		AssertSigned: true,
	}
	dec := NewPGPDecrypt(tcRecipient.G, decarg)
	m := NewMetaContextForTest(tcRecipient).WithUIs(uis)
	if err := RunEngine2(m, dec); err != nil {
		t.Fatal(err)
	}
	decmsg := string(decoded.Bytes())
	if decmsg != msg {
		t.Errorf("decoded: %q, expected: %q", decmsg, msg)
	}
}

// TestPGPDecryptSignedIdentify tests that the signer is
// identified regardless of AssertSigned, SignedBy args.
func TestPGPDecryptSignedIdentify(t *testing.T) {
	tcRecipient := SetupEngineTest(t, "PGPDecrypt - Recipient")
	defer tcRecipient.Cleanup()
	recipient := createFakeUserWithPGPSibkey(tcRecipient)
	Logout(tcRecipient)

	tcSigner := SetupEngineTest(t, "PGPDecrypt - Signer")
	defer tcSigner.Cleanup()
	signer := createFakeUserWithPGPSibkey(tcSigner)

	// encrypt a message
	msg := "We pride ourselves on being meticulous; no issue is too small."
	ctx := decengctx(signer, tcSigner)
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips:       []string{recipient.Username},
		Source:       strings.NewReader(msg),
		Sink:         sink,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(tcSigner.G, arg)
	if err := RunEngine2(ctx, enc); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	t.Logf("encrypted data: %x", out)

	// signer logs out, recipient logs in:
	t.Logf("signer (%q) logging out", signer.Username)
	Logout(tcSigner)
	t.Logf("recipient (%q) logging in", recipient.Username)
	recipient.LoginOrBust(tcRecipient)

	idUI := &FakeIdentifyUI{}
	pgpUI := &TestPgpUI{}
	uis := libkb.UIs{
		IdentifyUI: idUI,
		SecretUI:   recipient.NewSecretUI(),
		LogUI:      tcRecipient.G.UI.GetLogUI(),
		PgpUI:      pgpUI,
	}

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source:       bytes.NewReader(out),
		Sink:         decoded,
		AssertSigned: false,
	}
	dec := NewPGPDecrypt(tcRecipient.G, decarg)
	m := NewMetaContextForTest(tcRecipient).WithUIs(uis)
	if err := RunEngine2(m, dec); err != nil {
		t.Fatal(err)
	}

	if idUI.User == nil {
		t.Fatal("identify ui user is nil")
	}
	if idUI.User.Username != signer.Username {
		t.Errorf("idUI username: %q, expected %q", idUI.User.Username, signer.Username)
	}
	if pgpUI.OutputCount != 1 {
		t.Errorf("PgpUI output called %d times, expected 1", pgpUI.OutputCount)
	}
}

func TestPGPDecryptLong(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPSibkey(tc)

	// encrypt a message
	msg := make([]byte, 1024*1024)

	if _, err := rand.Read(msg); err != nil {
		t.Fatal(err)
	}

	sink := libkb.NewBufferCloser()
	ctx := decengctx(fu, tc)
	arg := &PGPEncryptArg{
		Source:       bytes.NewReader(msg),
		Sink:         sink,
		NoSign:       true,
		BinaryOutput: true,
	}
	enc := NewPGPEncrypt(tc.G, arg)
	if err := RunEngine2(ctx, enc); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   decoded,
	}
	dec := NewPGPDecrypt(tc.G, decarg)
	if err := RunEngine2(ctx, dec); err != nil {
		t.Fatal(err)
	}
	decmsg := decoded.Bytes()
	if len(decmsg) != len(msg) {
		t.Fatalf("decoded msg size: %d, expected %d", len(decmsg), len(msg))
	}

	for i, b := range msg {
		if decmsg[i] != b {
			t.Errorf("decode msg differs at byte %d: %x, expected %x", i, decmsg[i], b)
		}
	}

	if dec.Signer() != nil {
		t.Errorf("signer exists, but NoSign flag set to true")
	}
}

type cstest struct {
	name string
	msg  string
}

var cstests = []cstest{
	{name: "ascii", msg: "hello"},
	{name: "emoji", msg: "😓😕😙"},
}

func TestPGPDecryptClearsign(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()

	fu := createFakeUserWithPGPSibkey(tc)
	ctx := decengctx(fu, tc)

	for _, test := range cstests {
		signedMsg := sign(ctx, tc, test.msg, keybase1.SignMode_CLEAR)
		t.Logf("%s: signed message:\n\n%s\n", test.name, signedMsg)

		decoded := libkb.NewBufferCloser()
		arg := &PGPDecryptArg{
			Source: strings.NewReader(signedMsg),
			Sink:   decoded,
		}
		eng := NewPGPDecrypt(tc.G, arg)
		if err := RunEngine2(ctx, eng); err != nil {
			t.Errorf("%s: decrypt error: %q", test.name, err)
			continue
		}
		msg := decoded.Bytes()
		trimmed := strings.TrimSpace(string(msg))
		t.Logf("clearsign test %q decoded message: %s\n", test.name, trimmed)
		if trimmed != test.msg {
			t.Errorf("%s: expected msg %q, got %q", test.name, test.msg, trimmed)
		}

		status := eng.SignatureStatus()
		if !status.IsSigned {
			t.Errorf("%s: expected IsSigned", test.name)
		}
		if !status.Verified {
			t.Errorf("%s: expected Verified", test.name)
		}
		if status.Entity == nil {
			t.Errorf("%s: signature status entity is nil", test.name)
		}
	}
}

// TestPGPDecryptNonKeybase tests decrypt on a message
// created with a key unknown to keybase.
func TestPGPDecryptNonKeybase(t *testing.T) {
	tcRecipient := SetupEngineTest(t, "PGPDecrypt - Recipient")
	defer tcRecipient.Cleanup()
	recipient := createFakeUserWithPGPSibkey(tcRecipient)

	tcSigner := SetupEngineTest(t, "PGPDecrypt - Signer")
	defer tcSigner.Cleanup()
	keyA, err := tcSigner.MakePGPKey("keya@keybase.io")
	require.NoError(t, err)

	// find recipient key
	ur, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tcSigner.G, recipient.Username))
	if err != nil {
		t.Fatal(err)
	}
	rkeys := ur.GetActivePGPKeys(false)
	if len(rkeys) == 0 {
		t.Fatal("recipient has no active pgp keys")
	}

	// encrypt and sign a message with keyA
	mid := libkb.NewBufferCloser()
	msg := "Is it time for lunch?"
	recipients := []*libkb.PGPKeyBundle{keyA, rkeys[0]}
	if err := libkb.PGPEncrypt(strings.NewReader(msg), mid, keyA, recipients); err != nil {
		t.Fatal(err)
	}

	t.Logf("encrypted data: %x", mid.Bytes())

	idUI := &FakeIdentifyUI{}
	pgpUI := &TestPgpUI{}
	uis := libkb.UIs{
		IdentifyUI: idUI,
		SecretUI:   recipient.NewSecretUI(),
		LogUI:      tcRecipient.G.UI.GetLogUI(),
		PgpUI:      pgpUI,
	}

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source:       bytes.NewReader(mid.Bytes()),
		Sink:         decoded,
		AssertSigned: false,
	}
	dec := NewPGPDecrypt(tcRecipient.G, decarg)
	m := NewMetaContextForTest(tcRecipient).WithUIs(uis)
	if err := RunEngine2(m, dec); err != nil {
		t.Fatal(err)
	}

	if idUI.User != nil {
		if idUI.User.Username == recipient.Username {
			t.Errorf("pgp decrypt identified recipient")
		} else {
			t.Errorf("identify ui user is not nil: %s", idUI.User.Username)
		}
	}
	if pgpUI.OutputCount != 0 {
		t.Errorf("PgpUI OutputSignatureSuccess called %d times, expected 0", pgpUI.OutputCount)
	}
	if pgpUI.OutputNonKeybaseCount != 1 {
		t.Errorf("PgpUI OutputSignatureSuccessNonKeybase called %d times, expected 0", pgpUI.OutputNonKeybaseCount)
	}
}

type TestPgpUI struct {
	OutputCount           int
	OutputNonKeybaseCount int
	ShouldPush            bool
	Generated             keybase1.KeyGeneratedArg
}

func (t *TestPgpUI) OutputSignatureSuccess(context.Context, keybase1.OutputSignatureSuccessArg) error {
	t.OutputCount++
	return nil
}

func (t *TestPgpUI) OutputSignatureSuccessNonKeybase(context.Context, keybase1.OutputSignatureSuccessNonKeybaseArg) error {
	t.OutputNonKeybaseCount++
	return nil
}

func (t *TestPgpUI) KeyGenerated(ctx context.Context, arg keybase1.KeyGeneratedArg) error {
	t.Generated = arg
	return nil
}

func (t *TestPgpUI) ShouldPushPrivate(context.Context, keybase1.ShouldPushPrivateArg) (bool, error) {
	return t.ShouldPush, nil
}

func (t *TestPgpUI) Finished(context.Context, int) error {
	return nil
}

func TestPGPDecryptWithSyncedKey(t *testing.T) {
	tc0 := SetupEngineTest(t, "pgpg")
	defer tc0.Cleanup()

	u := createFakeUserWithPGPOnly(t, tc0)
	t.Log("Created fake user with PGP synced only")

	// find recipient key
	ur, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc0.G, u.Username))
	require.NoError(t, err, "loaded the user")
	rkeys := ur.GetActivePGPKeys(false)
	require.True(t, len(rkeys) > 0, "recipient has no active pgp keys")

	// encrypt and message with rkeys[0]
	mid := libkb.NewBufferCloser()
	msg := "Is it time for lunch?"
	recipients := []*libkb.PGPKeyBundle{rkeys[0]}
	err = libkb.PGPEncrypt(strings.NewReader(msg), mid, nil, recipients)
	require.NoError(t, err, "pgp encryption failed")
	t.Logf("encrypted data: %x", mid.Bytes())

	Logout(tc0)

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	uis := libkb.UIs{
		ProvisionUI: newTestProvisionUIPassphrase(),
		LoginUI:     &libkb.TestLoginUI{Username: u.Username},
		LogUI:       tc.G.UI.GetLogUI(),
		SecretUI:    u.NewSecretUI(),
		GPGUI:       &gpgtestui{},
	}
	eng := NewLogin(tc.G, libkb.DeviceTypeDesktop, "", keybase1.ClientType_CLI)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err = RunEngine2(m, eng)
	require.NoError(t, err, "no error when checking login")

	// decrypt it
	decryptIt := func() bool {
		decoded := libkb.NewBufferCloser()
		decarg := &PGPDecryptArg{
			Source:       bytes.NewReader(mid.Bytes()),
			Sink:         decoded,
			AssertSigned: false,
		}
		idUI := &FakeIdentifyUI{}
		pgpUI := &TestPgpUI{}
		secretUI := u.NewSecretUI()
		uis = libkb.UIs{
			IdentifyUI: idUI,
			SecretUI:   secretUI,
			LogUI:      tc.G.UI.GetLogUI(),
			PgpUI:      pgpUI,
		}
		dec := NewPGPDecrypt(tc.G, decarg)
		m = NewMetaContextForTest(tc).WithUIs(uis)
		err = RunEngine2(m, dec)
		require.NoError(t, err, "no error for PGP decrypt")

		decryptedMsg := decoded.Bytes()
		trimmed := strings.TrimSpace(string(decryptedMsg))
		t.Logf("decrypted msg: %s", trimmed)
		require.Equal(t, trimmed, msg, "msg equality failed")
		return secretUI.CalledGetPassphrase
	}

	decryptCalledPassphrase := decryptIt()
	// No need to get a passphrase, since we just logged in.
	require.False(t, decryptCalledPassphrase, "passphrase get wasn't called")

	clearCaches(m.G())

	decryptCalledPassphrase = decryptIt()
	require.True(t, decryptCalledPassphrase, "passphrase get was called")

	decryptCalledPassphrase = decryptIt()
	require.False(t, decryptCalledPassphrase, "passphrase get wasn't called")

}

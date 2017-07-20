// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"runtime/debug"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestGenerateNewPGPKey(t *testing.T) {
	tc := SetupEngineTest(t, "pgp")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "pgp")
	secui := &libkb.TestSecretUI{Passphrase: fu.Passphrase}
	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
	}
	arg.Gen.MakeAllIds()
	ctx := Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: secui,
	}
	eng := NewPGPKeyImportEngine(arg)
	err := RunEngine(eng, &ctx)
	if err != nil {
		t.Fatal(err)
	}
}

func TestPGPUserInterface(t *testing.T) {
	p := newPgpPair(t)
	defer p.cleanup()

	p.assert(!p.senderTracksRecipient(), "sender shouldn't track recipient")
	p.assert(!p.recipientTracksSender(), "recipient shouldn't track sender")

	// encrypt, not signed
	notSigned, idCount := p.encrypt(false)

	// test that identify ui was shown once to sender for recipient
	p.assertEqual(idCount, 1, "identify ui count [encrypt, not signed]")
	// with identify2, no tracking, so test that sender doesn't track recipient
	p.assert(!p.senderTracksRecipient(), "after encrypt, sender shouldn't track recipient")
	p.assert(!p.recipientTracksSender(), "after encrypt, recipient shouldn't track sender")

	// encrypt, signed
	signed, idCount := p.encrypt(true)

	// test that identify ui was *not* shown to sender for recipient since
	// just shown in previous p.encrypt() call.
	p.assertEqual(idCount, 0, "identify ui count [encrypt, signed]")
	// with identify2, not tracking, so test that sender doesn't track recipient
	p.assert(!p.senderTracksRecipient(), "after encrypt, sender shouldn't track recipient")
	p.assert(!p.recipientTracksSender(), "after encrypt, recipient shouldn't track sender")

	// decrypt, not signed
	p.checkIdentifyUIAndPgpUI("decrypt not signed", p.decrypt, notSigned, 0)

	// decrypt signed
	p.checkIdentifyUIAndPgpUI("decrypt signed", p.decrypt, signed, 1)

	// decrypt signed, assert signed by anyone
	p.checkIdentifyUIAndPgpUI("decrypt assert signed", p.decryptAssertSigned, signed, 1)

	// decrypt signed with user assertion
	p.checkIdentifyUIAndPgpUI("decrypt assert signed by", p.decryptAssertSignedBySender, signed, 1)

	// decrypt signed by self
	p.checkIdentifyUIAndPgpUI("decrypt self", p.decryptSelf, signed, 1)

	// decrypt assert signed by self
	p.checkIdentifyUIAndPgpUI("decrypt assert signed by self", p.decryptAssertSignedBySelf, signed, 1)

	// verify signed
	p.checkIdentifyUIAndPgpUI("verify signed", p.verify, signed, 1)

	// verify signed with assertion
	p.checkIdentifyUIAndPgpUI("verify assert signed by", p.verifyAssertSignedBySender, signed, 1)

	// verify signed by self
	p.checkIdentifyUIAndPgpUI("verify self", p.verifySelf, signed, 1)

	// verify assert signed by self
	p.checkIdentifyUIAndPgpUI("verify assert signed by self", p.verifyAssertSignedBySelf, signed, 1)
}

type pgpPair struct {
	t         *testing.T
	tcS       libkb.TestContext
	tcR       libkb.TestContext
	sender    *FakeUser
	recipient *FakeUser
}

func newPgpPair(t *testing.T) *pgpPair {
	p := pgpPair{t: t}
	p.tcS = SetupEngineTest(t, "sender")
	p.sender = createFakeUserWithPGPSibkey(p.tcS)

	p.tcR = SetupEngineTest(t, "recip")
	p.recipient = createFakeUserWithPGPSibkey(p.tcR)
	return &p
}

func (p *pgpPair) cleanup() {
	p.tcS.Cleanup()
	p.tcR.Cleanup()
}

func (p *pgpPair) assert(b bool, m string) {
	if b {
		return
	}
	p.t.Fatal(m)
}

func (p *pgpPair) assertEqual(actual, expected int, m string) {
	if actual == expected {
		return
	}
	p.t.Fatalf("%s: %d, expected %d", m, actual, expected)
}

func (p *pgpPair) checkIdentifyUIAndPgpUI(name string, f func(string) (int, int), m string, n int) {
	idCount, sigCount := f(m)

	// test that identify ui was shown n times
	p.assertEqual(idCount, n, name+": identify ui count")
	// test that recipient does not track sender
	p.assert(!p.recipientTracksSender(), name+": recipient shouldn't track sender")
	// test that signature success was shown n times
	p.assertEqual(sigCount, n, name+": sig ui count")
}

func (p *pgpPair) senderTracksRecipient() bool {
	return p.isTracking(p.tcS, p.recipient.Username)
}

func (p *pgpPair) recipientTracksSender() bool {
	return p.isTracking(p.tcR, p.sender.Username)
}

func (p *pgpPair) isTracking(meContext libkb.TestContext, username string) bool {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(meContext.G))
	if err != nil {
		p.t.Fatal(err)
	}
	them, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(meContext.G, username))
	if err != nil {
		p.t.Fatal(err)
	}
	s, err := me.TrackChainLinkFor(them.GetNormalizedName(), them.GetUID())
	if err != nil {
		p.t.Fatal(err)
	}
	return s != nil
}

func (p *pgpPair) encrypt(sign bool) (string, int) {
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
		FakeConfirmResult: &keybase1.ConfirmResult {
			IdentityConfirmed: true,
			RemoteConfirmed: false,
		},
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: p.sender.NewSecretUI()}
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips: []string{p.recipient.Username},
		Source: strings.NewReader("thank you for your order"),
		Sink:   sink,
		NoSign: !sign,
	}

	eng := NewPGPEncrypt(arg, p.tcS.G)
	if err := RunEngine(eng, ctx); err != nil {
		p.t.Fatal(err)
	}

	out := sink.Bytes()

	return string(out), p.idc(ctx)
}

func (p *pgpPair) decrypt(msg string) (int, int) {
	return p.doDecrypt(msg, &PGPDecryptArg{})
}

func (p *pgpPair) decryptAssertSigned(msg string) (int, int) {
	return p.doDecrypt(msg, &PGPDecryptArg{AssertSigned: true})
}

func (p *pgpPair) decryptAssertSignedBySender(msg string) (int, int) {
	return p.doDecrypt(msg, &PGPDecryptArg{SignedBy: p.sender.Username})
}

func (p *pgpPair) decryptSelf(msg string) (int, int) {
	ctx := decengctx(p.sender, p.tcS)
	arg := &PGPDecryptArg{
		Source: strings.NewReader(msg),
		Sink:   libkb.NewBufferCloser(),
	}
	dec := NewPGPDecrypt(arg, p.tcS.G)
	if err := RunEngine(dec, ctx); err != nil {
		p.t.Fatal(err)
	}
	return p.idc(ctx), p.sigc(ctx)
}

func (p *pgpPair) decryptAssertSignedBySelf(msg string) (int, int) {
	ctx := decengctx(p.sender, p.tcS)
	arg := &PGPDecryptArg{
		Source:   strings.NewReader(msg),
		Sink:     libkb.NewBufferCloser(),
		SignedBy: p.sender.Username,
	}
	dec := NewPGPDecrypt(arg, p.tcS.G)
	if err := RunEngine(dec, ctx); err != nil {
		p.t.Fatal(err)
	}
	return p.idc(ctx), p.sigc(ctx)
}

func (p *pgpPair) doDecrypt(msg string, arg *PGPDecryptArg) (int, int) {
	ctx := decengctx(p.recipient, p.tcR)
	arg.Source = strings.NewReader(msg)
	arg.Sink = libkb.NewBufferCloser()
	dec := NewPGPDecrypt(arg, p.tcR.G)
	if err := RunEngine(dec, ctx); err != nil {
		debug.PrintStack()
		p.t.Fatal(err)
	}
	return p.idc(ctx), p.sigc(ctx)
}

func (p *pgpPair) verify(msg string) (int, int) {
	ctx := decengctx(p.recipient, p.tcR)
	arg := &PGPVerifyArg{
		Source: strings.NewReader(msg),
	}
	eng := NewPGPVerify(arg, p.tcR.G)
	if err := RunEngine(eng, ctx); err != nil {
		p.t.Fatal(err)
	}
	return p.idc(ctx), p.sigc(ctx)
}

func (p *pgpPair) verifyAssertSignedBySender(msg string) (int, int) {
	ctx := decengctx(p.recipient, p.tcR)
	arg := &PGPVerifyArg{
		Source:   strings.NewReader(msg),
		SignedBy: p.sender.Username,
	}
	eng := NewPGPVerify(arg, p.tcR.G)
	if err := RunEngine(eng, ctx); err != nil {
		p.t.Fatal(err)
	}
	return p.idc(ctx), p.sigc(ctx)
}

func (p *pgpPair) verifySelf(msg string) (int, int) {
	ctx := decengctx(p.sender, p.tcS)
	arg := &PGPVerifyArg{
		Source: strings.NewReader(msg),
	}
	eng := NewPGPVerify(arg, p.tcS.G)
	if err := RunEngine(eng, ctx); err != nil {
		p.t.Fatal(err)
	}
	return p.idc(ctx), p.sigc(ctx)
}

func (p *pgpPair) verifyAssertSignedBySelf(msg string) (int, int) {
	ctx := decengctx(p.sender, p.tcS)
	arg := &PGPVerifyArg{
		Source:   strings.NewReader(msg),
		SignedBy: p.sender.Username,
	}
	eng := NewPGPVerify(arg, p.tcS.G)
	if err := RunEngine(eng, ctx); err != nil {
		p.t.Fatal(err)
	}
	return p.idc(ctx), p.sigc(ctx)
}

func (p *pgpPair) idc(ctx *Context) int {
	ui, ok := ctx.IdentifyUI.(*FakeIdentifyUI)
	if !ok {
		p.t.Fatalf("not FakeIdentifyUI: %T", ctx.IdentifyUI)
	}
	p.t.Logf("FakeIdentifyUI: %+v", ui)
	return ui.StartCount
}

func (p *pgpPair) sigc(ctx *Context) int {
	ui, ok := ctx.PgpUI.(*TestPgpUI)
	if !ok {
		p.t.Fatalf("not TestPgpUI: %T", ctx.PgpUI)
	}
	return ui.OutputCount
}

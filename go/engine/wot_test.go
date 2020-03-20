package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestWebOfTrustVouch(t *testing.T) {
	tc1 := SetupEngineTest(t, "wot")
	tc2 := SetupEngineTest(t, "wot")
	tc3 := SetupEngineTest(t, "wot")
	defer tc1.Cleanup()
	defer tc2.Cleanup()
	defer tc3.Cleanup()

	fu1 := CreateAndSignupFakeUser(tc1, "wot")
	fu2 := CreateAndSignupFakeUser(tc2, "wot")
	fu3 := CreateAndSignupFakeUser(tc3, "wot")

	// make mutual track b/w fu1 and fu2, fu1 and fu3
	sigVersion := libkb.GetDefaultSigVersion(tc1.G)
	trackUser(tc2, fu2, fu1.NormalizedUsername(), sigVersion)
	trackUser(tc1, fu1, fu2.NormalizedUsername(), sigVersion)
	trackUser(tc1, fu1, fu3.NormalizedUsername(), sigVersion)
	trackUser(tc3, fu3, fu1.NormalizedUsername(), sigVersion)

	err := fu2.LoadUser(tc2)
	require.NoError(tc2.T, err)

	err = fu1.LoadUser(tc1)
	require.NoError(tc1.T, err)
	idt := fu1.User.IDTable()
	lenBefore := idt.Len()
	// should be logged in as fu1, double check:
	require.Equal(t, tc1.G.ActiveDevice.UID(), fu1.UID())
	mctx := NewMetaContextForTest(tc1)

	// fu1 vouches for fu2
	arg := &WotVouchArg{
		Vouchee:    fu2.User.ToUserVersion(),
		Confidence: keybase1.Confidence{UsernameVerifiedVia: keybase1.UsernameVerificationType_OTHER_CHAT},
		VouchTexts: []string{"alice is awesome"},
	}

	eng := NewWotVouch(tc1.G, arg)
	err = RunEngine2(mctx, eng)
	require.NoError(t, err)

	err = fu1.LoadUser(tc1)
	require.NoError(tc1.T, err)
	idt = fu1.User.IDTable()

	// for now, let's just check that it got bigger:
	require.Equal(tc1.T, lenBefore+1, idt.Len())

	err = fu3.LoadUser(tc3)
	require.NoError(tc3.T, err)

	// make sure that if the user is attesting to something about
	// a user and eldest seqno changes, that they get an error.
	uv := fu3.User.ToUserVersion()
	uv.EldestSeqno++
	arg = &WotVouchArg{
		Vouchee:    uv,
		Confidence: keybase1.Confidence{UsernameVerifiedVia: keybase1.UsernameVerificationType_OTHER_CHAT},
		VouchTexts: []string{"bob is nice"},
	}
	eng = NewWotVouch(tc1.G, arg)
	err = RunEngine2(mctx, eng)
	require.Error(tc1.T, err)

	err = fu1.LoadUser(tc1)
	require.NoError(tc1.T, err)
	idt = fu1.User.IDTable()
	require.Equal(tc1.T, lenBefore+1, idt.Len())

	// make an fu1 -> fu3 attest with confidence stuff
	arg = &WotVouchArg{
		Vouchee:    fu3.User.ToUserVersion(),
		VouchTexts: []string{"charlie rocks"},
		Confidence: confidence,
	}
	eng = NewWotVouch(tc1.G, arg)
	err = RunEngine2(mctx, eng)
	require.NoError(tc1.T, err)

	err = fu1.LoadUser(tc1)
	require.NoError(tc1.T, err)
	idt = fu1.User.IDTable()
	require.Equal(tc1.T, lenBefore+2, idt.Len())
}

func TestWebOfTrustPending(t *testing.T) {
	tcAlice := SetupEngineTest(t, "wot")
	tcBob := SetupEngineTest(t, "wot")
	defer tcAlice.Cleanup()
	defer tcBob.Cleanup()
	alice := CreateAndSignupFakeUser(tcAlice, "wot")
	bob := CreateAndSignupFakeUser(tcBob, "wot")
	mctxA := NewMetaContextForTest(tcAlice)
	mctxB := NewMetaContextForTest(tcBob)
	t.Log("alice and bob exist")

	sigVersion := libkb.GetDefaultSigVersion(tcAlice.G)
	trackUser(tcBob, bob, alice.NormalizedUsername(), sigVersion)
	trackUser(tcAlice, alice, bob.NormalizedUsername(), sigVersion)
	err := bob.LoadUser(tcBob)
	require.NoError(tcBob.T, err)
	err = alice.LoadUser(tcAlice)
	require.NoError(tcAlice.T, err)
	t.Log("alice and bob follow each other")

	aliceName := alice.User.GetName()
	bobName := bob.User.GetName()

	var vouches []keybase1.WotVouch
	vouches, err = libkb.FetchWotVouches(mctxA, libkb.FetchWotVouchesArg{})
	require.NoError(t, err)
	require.Empty(t, vouches)
	t.Log("alice has no pending vouches")
	vouches, err = libkb.FetchWotVouches(mctxB, libkb.FetchWotVouchesArg{Vouchee: aliceName})
	require.NoError(t, err)
	require.Empty(t, vouches)
	t.Log("bob sees no vouches for Alice")

	firstVouch := "alice is wondibar but i don't have much confidence"
	vouchTexts := []string{firstVouch}
	arg := &WotVouchArg{
		Vouchee:    alice.User.ToUserVersion(),
		Confidence: keybase1.Confidence{UsernameVerifiedVia: keybase1.UsernameVerificationType_OTHER_CHAT},
		VouchTexts: vouchTexts,
	}
	eng := NewWotVouch(tcBob.G, arg)
	err = RunEngine2(mctxB, eng)
	require.NoError(t, err)
	t.Log("bob vouches for alice without confidence")

	vouches, err = libkb.FetchWotVouches(mctxA, libkb.FetchWotVouchesArg{})
	require.NoError(t, err)
	require.Len(t, vouches, 1)
	bobVouch := vouches[0]
	require.Equal(t, bob.User.GetUID(), bobVouch.Voucher.Uid)
	require.Equal(t, vouchTexts, bobVouch.VouchTexts)
	require.NotNil(t, bobVouch.Confidence)
	require.EqualValues(t, keybase1.UsernameVerificationType_OTHER_CHAT, bobVouch.Confidence.UsernameVerifiedVia)
	require.Equal(t, keybase1.WotStatusType_PROPOSED, bobVouch.Status)
	t.Log("alice sees one pending vouch")
	vouches, err = libkb.FetchWotVouches(mctxB, libkb.FetchWotVouchesArg{Vouchee: aliceName})
	require.NoError(t, err)
	require.Empty(t, vouches)
	t.Log("bob sees no vouches for Alice")
	vouches, err = libkb.FetchWotVouches(mctxB, libkb.FetchWotVouchesArg{Vouchee: aliceName, Voucher: bobName})
	require.NoError(t, err)
	require.Equal(t, 1, len(vouches))
	t.Log("bob sees pending vouch for Alice")

	tcCharlie := SetupEngineTest(t, "wot")
	defer tcCharlie.Cleanup()
	charlie := CreateAndSignupFakeUser(tcCharlie, "wot")
	mctxC := NewMetaContextForTest(tcCharlie)
	t.Log("charlie exists")

	trackUser(tcCharlie, charlie, alice.NormalizedUsername(), sigVersion)
	trackUser(tcAlice, alice, charlie.NormalizedUsername(), sigVersion)
	err = charlie.LoadUser(tcCharlie)
	require.NoError(tcCharlie.T, err)
	t.Log("alice and charlie follow each other")

	charlieName := charlie.User.GetName()

	vouchTexts = []string{"alice is wondibar and doug agrees"}
	arg = &WotVouchArg{
		Vouchee:    alice.User.ToUserVersion(),
		VouchTexts: vouchTexts,
		Confidence: confidence,
	}
	eng = NewWotVouch(tcCharlie.G, arg)
	err = RunEngine2(mctxC, eng)
	require.NoError(t, err)
	t.Log("charlie vouches for alice with confidence")

	// ensure alice does a full load of bob by adding another link
	// to bob's chain so the wot.vouch isn't the last one (which is always unstubbed)
	// and nuking alice's local db to wipe any cache
	trackUser(tcBob, bob, charlie.NormalizedUsername(), sigVersion)
	_, err = mctxA.G().LocalDb.Nuke()
	require.NoError(t, err)

	vouches, err = libkb.FetchWotVouches(mctxA, libkb.FetchWotVouchesArg{})
	require.NoError(t, err)
	require.Len(t, vouches, 2)
	require.EqualValues(t, bobVouch, vouches[0])
	charlieVouch := vouches[1]
	require.Equal(t, keybase1.WotStatusType_PROPOSED, charlieVouch.Status)
	require.Equal(t, confidence, *charlieVouch.Confidence)
	t.Log("alice sees two pending vouches")

	// alice gets just charlie's vouch using FetchWotVouches
	vouches, err = libkb.FetchWotVouches(mctxA, libkb.FetchWotVouchesArg{Vouchee: aliceName, Voucher: charlieName})
	require.NoError(t, err)
	require.Len(t, vouches, 1)
	require.Equal(t, keybase1.WotStatusType_PROPOSED, vouches[0].Status)
	t.Log("alice sees charlie's pending vouch")
}

func TestWebOfTrustAccept(t *testing.T) {
	tcAlice := SetupEngineTest(t, "wot")
	tcBob := SetupEngineTest(t, "wot")
	defer tcAlice.Cleanup()
	defer tcBob.Cleanup()
	alice := CreateAndSignupFakeUser(tcAlice, "wot")
	bob := CreateAndSignupFakeUser(tcBob, "wot")
	mctxA := NewMetaContextForTest(tcAlice)
	mctxB := NewMetaContextForTest(tcBob)
	t.Log("alice and bob exist")

	sigVersion := libkb.GetDefaultSigVersion(tcAlice.G)
	trackUser(tcBob, bob, alice.NormalizedUsername(), sigVersion)
	trackUser(tcAlice, alice, bob.NormalizedUsername(), sigVersion)
	err := bob.LoadUser(tcBob)
	require.NoError(tcBob.T, err)
	err = alice.LoadUser(tcAlice)
	require.NoError(tcAlice.T, err)
	t.Log("alice and bob follow each other")

	aliceName := alice.User.GetName()

	vouchTexts := []string{"alice is wondibar and doug agrees"}
	argV := &WotVouchArg{
		Vouchee:    alice.User.ToUserVersion(),
		VouchTexts: vouchTexts,
		Confidence: confidence,
	}
	engV := NewWotVouch(tcBob.G, argV)
	err = RunEngine2(mctxB, engV)
	require.NoError(t, err)
	t.Log("bob vouches for alice with confidence")

	vouches, err := libkb.FetchWotVouches(mctxA, libkb.FetchWotVouchesArg{})
	require.NoError(t, err)
	require.Len(t, vouches, 1)
	bobVouch := vouches[0]
	require.Equal(t, keybase1.WotStatusType_PROPOSED, bobVouch.Status)
	require.Equal(t, bob.User.GetUID(), bobVouch.Voucher.Uid)
	require.Equal(t, vouchTexts, bobVouch.VouchTexts)
	t.Log("alice fetches one pending vouch")

	argR := &WotReactArg{
		Voucher:  bob.User.ToUserVersion(),
		Proof:    bobVouch.VouchProof,
		Reaction: keybase1.WotReactionType_ACCEPT,
	}
	engR := NewWotReact(tcAlice.G, argR)
	err = RunEngine2(mctxA, engR)
	require.NoError(t, err)
	t.Log("alice accepts")

	vouches, err = libkb.FetchWotVouches(mctxA, libkb.FetchWotVouchesArg{})
	require.NoError(t, err)
	require.Equal(t, 1, len(vouches))
	vouch := vouches[0]
	require.Equal(t, keybase1.WotStatusType_ACCEPTED, vouch.Status)
	require.Equal(t, bob.User.GetUID(), vouch.Voucher.Uid)
	require.Equal(t, vouchTexts, vouch.VouchTexts)
	require.EqualValues(t, confidence, *vouch.Confidence)

	vouches, err = libkb.FetchWotVouches(mctxB, libkb.FetchWotVouchesArg{Vouchee: aliceName})
	require.NoError(t, err)
	require.Equal(t, 1, len(vouches))
	vouch = vouches[0]
	require.Equal(t, keybase1.WotStatusType_ACCEPTED, vouch.Status)
	require.Equal(t, bob.User.GetUID(), vouch.Voucher.Uid)
	require.Equal(t, vouchTexts, vouch.VouchTexts)
	require.EqualValues(t, confidence, *vouch.Confidence)
}

func TestWebOfTrustReject(t *testing.T) {
	tcAlice := SetupEngineTest(t, "wot")
	tcBob := SetupEngineTest(t, "wot")
	defer tcAlice.Cleanup()
	defer tcBob.Cleanup()
	alice := CreateAndSignupFakeUser(tcAlice, "wot")
	bob := CreateAndSignupFakeUser(tcBob, "wot")
	mctxA := NewMetaContextForTest(tcAlice)
	mctxB := NewMetaContextForTest(tcBob)
	t.Log("alice and bob exist")

	sigVersion := libkb.GetDefaultSigVersion(tcAlice.G)
	trackUser(tcBob, bob, alice.NormalizedUsername(), sigVersion)
	trackUser(tcAlice, alice, bob.NormalizedUsername(), sigVersion)
	err := bob.LoadUser(tcBob)
	require.NoError(tcBob.T, err)
	err = alice.LoadUser(tcAlice)
	require.NoError(tcAlice.T, err)
	t.Log("alice and bob follow each other")

	aliceName := alice.User.GetName()

	vouchTexts := []string{"alice is wondibar"}
	argV := &WotVouchArg{
		Vouchee:    alice.User.ToUserVersion(),
		Confidence: keybase1.Confidence{UsernameVerifiedVia: keybase1.UsernameVerificationType_OTHER_CHAT},
		VouchTexts: vouchTexts,
	}
	engV := NewWotVouch(tcBob.G, argV)
	err = RunEngine2(mctxB, engV)
	require.NoError(t, err)
	t.Log("bob vouches for alice")

	vouches, err := libkb.FetchWotVouches(mctxA, libkb.FetchWotVouchesArg{})
	require.NoError(t, err)
	require.Len(t, vouches, 1)
	bobVouch := vouches[0]
	require.Equal(t, keybase1.WotStatusType_PROPOSED, bobVouch.Status)
	require.Equal(t, bob.User.GetUID(), bobVouch.Voucher.Uid)
	require.Equal(t, vouchTexts, bobVouch.VouchTexts)
	t.Log("alice fetches one pending vouch")

	argR := &WotReactArg{
		Voucher:  bob.User.ToUserVersion(),
		Proof:    bobVouch.VouchProof,
		Reaction: keybase1.WotReactionType_REJECT,
	}
	engR := NewWotReact(tcAlice.G, argR)
	err = RunEngine2(mctxA, engR)
	require.NoError(t, err)
	t.Log("alice rejects it")

	vouches, err = libkb.FetchWotVouches(mctxA, libkb.FetchWotVouchesArg{})
	require.NoError(t, err)
	require.Equal(t, 1, len(vouches))
	vouch := vouches[0]
	require.Equal(t, keybase1.WotStatusType_REJECTED, vouch.Status)
	require.Equal(t, bob.User.GetUID(), vouch.Voucher.Uid)
	require.Equal(t, vouchTexts, vouch.VouchTexts)
	require.NotNil(t, vouch.Confidence)
	require.EqualValues(t, keybase1.UsernameVerificationType_OTHER_CHAT, bobVouch.Confidence.UsernameVerifiedVia)
	t.Log("alice can see it as rejected")

	vouches, err = libkb.FetchWotVouches(mctxB, libkb.FetchWotVouchesArg{Vouchee: aliceName})
	require.NoError(t, err)
	require.Equal(t, 0, len(vouches))
	t.Log("bob cannot see it")
}

// perhaps revisit after Y2K-1494
func TestWebOfTrustSigBug(t *testing.T) {
	tcAlice := SetupEngineTest(t, "wot")
	tcBob := SetupEngineTest(t, "wot")
	defer tcAlice.Cleanup()
	defer tcBob.Cleanup()
	alice := CreateAndSignupFakeUser(tcAlice, "wot")
	bob := CreateAndSignupFakeUser(tcBob, "wot")
	mctxA := NewMetaContextForTest(tcAlice)
	mctxB := NewMetaContextForTest(tcBob)
	t.Log("alice and bob exist")

	sigVersion := libkb.GetDefaultSigVersion(tcAlice.G)
	trackUser(tcBob, bob, alice.NormalizedUsername(), sigVersion)
	trackUser(tcAlice, alice, bob.NormalizedUsername(), sigVersion)
	err := bob.LoadUser(tcBob)
	require.NoError(tcBob.T, err)
	err = alice.LoadUser(tcAlice)
	require.NoError(tcAlice.T, err)
	t.Log("alice and bob follow each other")

	// bob vouches for alice
	firstVouch := "alice is wondibar cause we texted"
	vouchTexts := []string{firstVouch}
	argV := &WotVouchArg{
		Vouchee:    alice.User.ToUserVersion(),
		Confidence: keybase1.Confidence{UsernameVerifiedVia: keybase1.UsernameVerificationType_OTHER_CHAT},
		VouchTexts: vouchTexts,
	}
	engV := NewWotVouch(tcBob.G, argV)
	err = RunEngine2(mctxB, engV)
	require.NoError(t, err)

	// alice rejects
	vouches, err := libkb.FetchWotVouches(mctxA, libkb.FetchWotVouchesArg{})
	require.NoError(t, err)
	require.Len(t, vouches, 1)
	bobVouch := vouches[0]
	argR := &WotReactArg{
		Voucher:  bob.User.ToUserVersion(),
		Proof:    bobVouch.VouchProof,
		Reaction: keybase1.WotReactionType_REJECT,
	}
	engR := NewWotReact(tcAlice.G, argR)
	err = RunEngine2(mctxA, engR)
	require.NoError(t, err)
	t.Log("alice rejects it")
	_, err = mctxA.G().LocalDb.Nuke()
	require.NoError(t, err)

	// bob vouches for alice
	engV2 := NewWotVouch(tcBob.G, argV)
	err = RunEngine2(mctxB, engV2)
	require.NoError(t, err)

	// this attestation is correctly recognized as proposed
	vouches, err = libkb.FetchWotVouches(mctxA, libkb.FetchWotVouchesArg{})
	require.NoError(t, err)
	bobVouch = vouches[0]
	require.Equal(t, bobVouch.Status, keybase1.WotStatusType_PROPOSED)
}

var confidence = keybase1.Confidence{
	UsernameVerifiedVia: keybase1.UsernameVerificationType_PROOFS,
	Proofs: []keybase1.WotProof{
		{ProofType: keybase1.ProofType_REDDIT, Name: "reddit", Username: "betaveros"},
		{ProofType: keybase1.ProofType_GENERIC_SOCIAL, Name: "mastodon.social", Username: "gammaveros"},
		{ProofType: keybase1.ProofType_GENERIC_WEB_SITE, Protocol: "https:", Username: "beta.veros"},
		{ProofType: keybase1.ProofType_DNS, Protocol: "dns", Username: "beta.veros"},
	},
}

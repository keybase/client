package engine

import (
	"fmt"
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
		VouchText:  "alice is awesome",
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
		VouchText:  "bob is nice",
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
		VouchText:  "charlie rocks",
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
	arg := &WotVouchArg{
		Vouchee:    alice.User.ToUserVersion(),
		Confidence: keybase1.Confidence{UsernameVerifiedVia: keybase1.UsernameVerificationType_OTHER_CHAT},
		VouchText:  firstVouch,
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
	require.Equal(t, bobName, bobVouch.VoucherUsername)
	require.Equal(t, aliceName, bobVouch.VoucheeUsername)
	require.Equal(t, firstVouch, bobVouch.VouchText)
	require.NotNil(t, bobVouch.Confidence)
	require.EqualValues(t, keybase1.UsernameVerificationType_OTHER_CHAT, bobVouch.Confidence.UsernameVerifiedVia)
	require.Equal(t, keybase1.WotStatusType_PROPOSED, bobVouch.Status)
	t.Log("alice sees one pending vouch")
	vouches, err = libkb.FetchWotVouches(mctxB, libkb.FetchWotVouchesArg{Vouchee: aliceName})
	require.NoError(t, err)
	require.Equal(t, 1, len(vouches))
	t.Log("bob also sees his pending vouch for Alice")

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

	vouchText := "alice is wondibar and doug agrees"
	arg = &WotVouchArg{
		Vouchee:    alice.User.ToUserVersion(),
		VouchText:  vouchText,
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
	require.Equal(t, confidence, charlieVouch.Confidence)
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
	bobName := bob.User.GetName()

	vouchText := "alice is wondibar and doug agrees"
	argV := &WotVouchArg{
		Vouchee:    alice.User.ToUserVersion(),
		VouchText:  vouchText,
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
	require.Equal(t, bobName, bobVouch.VoucherUsername)
	require.Equal(t, aliceName, bobVouch.VoucheeUsername)
	require.Equal(t, vouchText, bobVouch.VouchText)
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
	require.Equal(t, vouchText, vouch.VouchText)
	require.EqualValues(t, confidence, vouch.Confidence)

	vouches, err = libkb.FetchWotVouches(mctxB, libkb.FetchWotVouchesArg{Vouchee: aliceName})
	require.NoError(t, err)
	require.Equal(t, 1, len(vouches))
	vouch = vouches[0]
	require.Equal(t, keybase1.WotStatusType_ACCEPTED, vouch.Status)
	require.Equal(t, bob.User.GetUID(), vouch.Voucher.Uid)
	require.Equal(t, vouchText, vouch.VouchText)
	require.EqualValues(t, confidence, vouch.Confidence)
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

	vouchText := "alice is wondibar"
	argV := &WotVouchArg{
		Vouchee:    alice.User.ToUserVersion(),
		Confidence: keybase1.Confidence{UsernameVerifiedVia: keybase1.UsernameVerificationType_OTHER_CHAT},
		VouchText:  vouchText,
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
	require.Equal(t, vouchText, bobVouch.VouchText)
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
	require.Equal(t, vouchText, vouch.VouchText)
	require.NotNil(t, vouch.Confidence)
	require.EqualValues(t, keybase1.UsernameVerificationType_OTHER_CHAT, bobVouch.Confidence.UsernameVerifiedVia)
	t.Log("alice can see it as rejected")

	vouches, err = libkb.FetchWotVouches(mctxB, libkb.FetchWotVouchesArg{Vouchee: aliceName})
	require.NoError(t, err)
	require.Equal(t, 1, len(vouches))
	require.Equal(t, keybase1.WotStatusType_REJECTED, vouches[0].Status)
	t.Log("bob can also see it as rejected")
}

func TestWebOfTrustRevoke(t *testing.T) {
	var err error
	tcAlice := SetupEngineTest(t, "wot")
	defer tcAlice.Cleanup()
	tcBob := SetupEngineTest(t, "wot")
	defer tcBob.Cleanup()
	alice := CreateAndSignupFakeUser(tcAlice, "wot")
	uisA := libkb.UIs{
		LogUI:    tcAlice.G.UI.GetLogUI(),
		SecretUI: alice.NewSecretUI(),
	}
	mctxA := NewMetaContextForTest(tcAlice).WithUIs(uisA)
	bob := CreateAndSignupFakeUser(tcBob, "wot")
	uisB := libkb.UIs{
		LogUI:    tcBob.G.UI.GetLogUI(),
		SecretUI: bob.NewSecretUI(),
	}
	mctxB := NewMetaContextForTest(tcBob).WithUIs(uisB)
	aliceName := alice.NormalizedUsername().String()
	bobName := bob.NormalizedUsername().String()
	t.Logf("alice: %s and bob: %s exist", aliceName, bobName)
	sigVersion := libkb.GetDefaultSigVersion(tcAlice.G)
	trackUser(tcBob, bob, alice.NormalizedUsername(), sigVersion)
	trackUser(tcAlice, alice, bob.NormalizedUsername(), sigVersion)
	err = bob.LoadUser(tcBob)
	require.NoError(tcBob.T, err)
	err = alice.LoadUser(tcAlice)
	require.NoError(tcAlice.T, err)
	t.Log("alice and bob follow each other")

	bobVouchesForAlice := func(version int) {
		vouchText := fmt.Sprintf("alice is wondibar v%d", version)
		arg := &WotVouchArg{
			Vouchee:    alice.User.ToUserVersion(),
			VouchText:  vouchText,
			Confidence: confidence,
		}
		eng := NewWotVouch(tcBob.G, arg)
		err = RunEngine2(mctxB, eng)
		require.NoError(t, err)
	}
	aliceAccepts := func(sigID keybase1.SigID) error {
		arg := &WotReactArg{
			Voucher:  bob.User.ToUserVersion(),
			Proof:    sigID,
			Reaction: keybase1.WotReactionType_ACCEPT,
		}
		eng := NewWotReact(tcAlice.G, arg)
		return RunEngine2(mctxA, eng)
	}
	aliceRejects := func(sigID keybase1.SigID) error {
		arg := &WotReactArg{
			Voucher:  bob.User.ToUserVersion(),
			Proof:    sigID,
			Reaction: keybase1.WotReactionType_REJECT,
		}
		eng := NewWotReact(tcAlice.G, arg)
		return RunEngine2(mctxA, eng)
	}
	assertFetch := func(mctx libkb.MetaContext, version int, expectedStatus keybase1.WotStatusType) keybase1.WotVouch {
		vouches, err := libkb.FetchWotVouches(mctx, libkb.FetchWotVouchesArg{Voucher: bobName, Vouchee: aliceName})
		require.NoError(t, err)
		require.Equal(t, 1, len(vouches))
		vouch := vouches[0]
		require.Equal(t, expectedStatus, vouch.Status)
		require.Equal(t, bob.User.GetUID(), vouch.Voucher.Uid)
		require.Equal(t, alice.User.GetUID(), vouch.Vouchee.Uid)
		expectedVouchText := fmt.Sprintf("alice is wondibar v%d", version)
		require.Equal(t, expectedVouchText, vouch.VouchText)
		require.NotNil(t, vouch.Confidence)
		return vouch
	}
	revokeSig := func(mctx libkb.MetaContext, sigID string) {
		eng := NewRevokeSigsEngine(mctx.G(), []string{sigID})
		err := RunEngine2(mctx, eng)
		require.NoError(t, err)
	}

	// bob vouches for alice
	vouchVersion := 1
	bobVouchesForAlice(vouchVersion)
	_ = assertFetch(mctxA, vouchVersion, keybase1.WotStatusType_PROPOSED)
	wotVouchOne := assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_PROPOSED)
	t.Log("bob vouches for alice and everything looks good")

	// bob revokes the attestation
	revokeSig(mctxB, wotVouchOne.VouchProof.String())
	_ = assertFetch(mctxA, vouchVersion, keybase1.WotStatusType_REVOKED)
	_ = assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_REVOKED)
	t.Log("bob revokes the chainlink with the attestation, and it comes back `revoked` for both of them")

	// bob vouches again
	vouchVersion++
	bobVouchesForAlice(vouchVersion)
	_ = assertFetch(mctxA, vouchVersion, keybase1.WotStatusType_PROPOSED)
	wotVouchTwo := assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_PROPOSED)

	// alice cannot accept the revoked proof
	err = aliceAccepts(wotVouchOne.VouchProof)
	require.Error(t, err)
	// alice accepts the new proposed proof
	err = aliceAccepts(wotVouchTwo.VouchProof)
	require.NoError(t, err)
	_ = assertFetch(mctxA, vouchVersion, keybase1.WotStatusType_ACCEPTED)
	_ = assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_ACCEPTED)

	// alice revokes her acceptance
	err = alice.LoadUser(tcAlice)
	require.NoError(t, err)
	aliceLastLink := alice.User.GetLastLink()
	tlink, w := libkb.NewTypedChainLink(aliceLastLink)
	require.Nil(t, w)
	reactionLink, ok := tlink.(*libkb.WotReactChainLink)
	require.True(t, ok)
	revokeSig(mctxA, reactionLink.GetSigID().String())
	// it goes back to proposed
	_ = assertFetch(mctxA, vouchVersion, keybase1.WotStatusType_PROPOSED)
	_ = assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_PROPOSED)
	// and now she accepts it and it looks accepted to both of them
	err = aliceAccepts(wotVouchTwo.VouchProof)
	require.NoError(t, err)
	_ = assertFetch(mctxA, vouchVersion, keybase1.WotStatusType_ACCEPTED)
	_ = assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_ACCEPTED)

	// bob revokes and it shows up as revoked
	revokeSig(mctxB, wotVouchTwo.VouchProof.String())
	_ = assertFetch(mctxA, vouchVersion, keybase1.WotStatusType_REVOKED)
	_ = assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_REVOKED)

	///////////
	// VouchWithRevoke
	///////////
	assertUserLastLinkIsVouchWithRevoke := func(user *FakeUser, tc libkb.TestContext) *libkb.WotVouchChainLink {
		err := user.LoadUser(tc)
		require.NoError(t, err)
		lastLink := user.User.GetLastLink()
		tlink, warning := libkb.NewTypedChainLink(lastLink)
		require.Nil(t, warning)
		vouchLink, ok := tlink.(*libkb.WotVouchChainLink)
		require.True(t, ok)
		require.Equal(t, 1, len(vouchLink.Revocations))
		return vouchLink
	}
	vouchVersion++
	bobVouchesForAlice(vouchVersion)
	_ = assertFetch(mctxA, vouchVersion, keybase1.WotStatusType_PROPOSED)
	vouchToRevoke := assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_PROPOSED)
	// another vouch on top of an unrevoked previous one should be of type vouchWithRevoke
	vouchVersion++
	bobVouchesForAlice(vouchVersion)
	_ = assertFetch(mctxA, vouchVersion, keybase1.WotStatusType_PROPOSED)
	vouchToAccept := assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_PROPOSED)
	vwrLink := assertUserLastLinkIsVouchWithRevoke(bob, tcBob)
	require.Contains(t, vwrLink.Revocations, vouchToRevoke.VouchProof)
	err = aliceAccepts(vouchToRevoke.VouchProof)
	require.Error(t, err)

	// can vouchWithRevoke an accepted vouch, and then accept it
	err = aliceAccepts(vouchToAccept.VouchProof)
	vouchToRevoke = vouchToAccept
	require.NoError(t, err)
	vouchVersion++
	bobVouchesForAlice(vouchVersion)
	vouchToAccept = assertFetch(mctxA, vouchVersion, keybase1.WotStatusType_PROPOSED)
	_ = assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_PROPOSED)
	vwrLink = assertUserLastLinkIsVouchWithRevoke(bob, tcBob)
	require.Contains(t, vwrLink.Revocations, vouchToRevoke.VouchProof)
	err = aliceAccepts(vouchToAccept.VouchProof)
	require.NoError(t, err)
	// it is significant that bob has not loaded alice between these two steps
	// see comment in sig_chain.go#GetLinkFromSigID
	err = aliceRejects(vouchToAccept.VouchProof)
	require.NoError(t, err)

	// can vouchWithRevoke a rejected vouch, and then accept it
	vouchToRevoke = assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_REJECTED)
	bobVouchesForAlice(vouchVersion)
	_ = assertFetch(mctxA, vouchVersion, keybase1.WotStatusType_PROPOSED)
	vouchToAccept = assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_PROPOSED)
	vwrLink = assertUserLastLinkIsVouchWithRevoke(bob, tcBob)
	require.Contains(t, vwrLink.Revocations, vouchToRevoke.VouchProof)
	err = aliceAccepts(vouchToAccept.VouchProof)
	require.NoError(t, err)

	// confirm that vouch and vouchWithRevoke links are not stubbed by the server
	// by checking that, when they are not the last link in someone's chain (which is always unstubbed),
	// an unstubbed load is successful, and subsequently, those vouches are reactable.
	// ------------------------------------------
	// create a new user
	tcCharlie := SetupEngineTest(t, "wot")
	defer tcCharlie.Cleanup()
	charlie := CreateAndSignupFakeUser(tcCharlie, "wot")
	// clear out so our next vouch link doesn't have a revoke
	revokeSig(mctxB, vouchToAccept.VouchProof.String())

	assertVouchLinkLoadsCleanly := func(vouchToAccept keybase1.WotVouch) {
		// add two stubbable links to the end of bob's chain
		trackUser(tcBob, bob, charlie.NormalizedUsername(), sigVersion)
		require.NoError(t, runUntrack(tcBob, bob, charlie.NormalizedUsername().String(), sigVersion))
		// wipe alice so the load is definitely uncached
		_, err := mctxA.G().LocalDb.Nuke()
		require.NoError(t, err)
		// alice can do a normal stubbed load of bob (there are no problems with vouch links being stubbed)
		_, err = libkb.LoadUser(libkb.NewLoadUserByNameArg(tcAlice.G, bobName))
		require.NoError(t, err)
		// alice can still react to this link after having done a stubbed load
		err = aliceAccepts(vouchToAccept.VouchProof)
		require.NoError(t, err)
	}
	// a vouch link buried inside a sigchain does not cause loading/stubbing issues
	vouchVersion++
	bobVouchesForAlice(vouchVersion)
	vouchToAccept = assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_PROPOSED)
	assertVouchLinkLoadsCleanly(vouchToAccept)
	// a vouch_with_revoke link buried inside a sigchain does not cause loading/stubbing issues
	vouchVersion++
	bobVouchesForAlice(vouchVersion)
	_ = assertUserLastLinkIsVouchWithRevoke(bob, tcBob)
	vouchToAccept = assertFetch(mctxB, vouchVersion, keybase1.WotStatusType_PROPOSED)
	assertVouchLinkLoadsCleanly(vouchToAccept)
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
	argV := &WotVouchArg{
		Vouchee:    alice.User.ToUserVersion(),
		Confidence: keybase1.Confidence{UsernameVerifiedVia: keybase1.UsernameVerificationType_OTHER_CHAT},
		VouchText:  firstVouch,
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

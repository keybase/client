// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func runTrack(tc libkb.TestContext, fu *FakeUser, username string, sigVersion libkb.SigVersion) (idUI *FakeIdentifyUI, them *libkb.User, err error) {
	sv := keybase1.SigVersion(sigVersion)
	return runTrackWithOptions(tc, fu, username, keybase1.TrackOptions{BypassConfirm: true, SigVersion: &sv}, fu.NewSecretUI(), false)
}

func runTrackWithOptions(tc libkb.TestContext, fu *FakeUser, username string, options keybase1.TrackOptions, secretUI libkb.SecretUI, forceRemoteCheck bool) (idUI *FakeIdentifyUI, them *libkb.User, err error) {
	idUI = &FakeIdentifyUI{}

	arg := &TrackEngineArg{
		UserAssertion:    username,
		Options:          options,
		ForceRemoteCheck: forceRemoteCheck,
	}
	uis := libkb.UIs{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   secretUI,
	}
	eng := NewTrackEngine(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err = RunEngine2(m, eng)
	them = eng.User()
	return
}

func assertTracking(tc libkb.TestContext, username string) {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	require.NoError(tc.T, err)

	them, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, username))
	require.NoError(tc.T, err)

	m := NewMetaContextForTest(tc)
	s, err := me.TrackChainLinkFor(m, them.GetNormalizedName(), them.GetUID())
	require.NoError(tc.T, err)
	require.NotNil(tc.T, s)
}

func assertNotTracking(tc libkb.TestContext, username string) {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	require.NoError(tc.T, err)

	them, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, username))
	require.NoError(tc.T, err)

	m := NewMetaContextForTest(tc)
	s, err := me.TrackChainLinkFor(m, them.GetNormalizedName(), them.GetUID())
	require.NoError(tc.T, err)
	require.Nil(tc.T, s)
}

func trackAlice(tc libkb.TestContext, fu *FakeUser, sigVersion libkb.SigVersion) {
	sv := keybase1.SigVersion(sigVersion)
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{BypassConfirm: true, SigVersion: &sv}, fu.NewSecretUI())
}

func trackUser(tc libkb.TestContext, fu *FakeUser, un libkb.NormalizedUsername, sigVersion libkb.SigVersion) {
	sv := keybase1.SigVersion(sigVersion)
	_, _, err := runTrackWithOptions(tc, fu, un.String(), keybase1.TrackOptions{BypassConfirm: true, SigVersion: &sv}, fu.NewSecretUI(), false)
	require.NoError(tc.T, err)
}

func trackUserGetUI(tc libkb.TestContext, fu *FakeUser, un libkb.NormalizedUsername, sigVersion libkb.SigVersion) *FakeIdentifyUI {
	sv := keybase1.SigVersion(sigVersion)
	ui, _, err := runTrackWithOptions(tc, fu, un.String(), keybase1.TrackOptions{BypassConfirm: true, SigVersion: &sv}, fu.NewSecretUI(), false)
	require.NoError(tc.T, err)
	return ui
}

func trackAliceWithOptions(tc libkb.TestContext, fu *FakeUser, options keybase1.TrackOptions, secretUI libkb.SecretUI) {
	idUI, res, err := runTrackWithOptions(tc, fu, "t_alice", options, secretUI, false)
	require.NoError(tc.T, err)
	upk, err := res.ExportToUPKV2AllIncarnations()
	require.NoError(tc.T, err)
	checkAliceProofs(tc.T, idUI, &upk.Current)
	assertTracking(tc, "t_alice")
}

func trackBob(tc libkb.TestContext, fu *FakeUser, sigVersion libkb.SigVersion) {
	sv := keybase1.SigVersion(sigVersion)
	trackBobWithOptions(tc, fu, keybase1.TrackOptions{BypassConfirm: true, SigVersion: &sv}, fu.NewSecretUI())
}

func trackBobWithOptions(tc libkb.TestContext, fu *FakeUser, options keybase1.TrackOptions, secretUI libkb.SecretUI) {
	// Refer to t_bob as kbtester1@twitter. This helps test a different
	// codepath through idenfity2. (For example, in one case it triggered a
	// race condition that aborted tracking without waiting for the UI to
	// confirm, which wasn't present in the regular "t_bob" case.)

	idUI, res, err := runTrackWithOptions(tc, fu, "kbtester1@twitter", options, secretUI, false)
	require.NoError(tc.T, err)
	upk, err := res.ExportToUPKV2AllIncarnations()
	require.NoError(tc.T, err)
	checkBobProofs(tc.T, idUI, &upk.Current)
	assertTracking(tc, "t_bob")
}

func TestTrack(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testTrack(t, sigVersion)
	})
}

func _testTrack(t *testing.T, sigVersion libkb.SigVersion) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	trackAlice(tc, fu, sigVersion)
	defer untrackAlice(tc, fu, sigVersion)

	// Assert that we gracefully handle the case of no login
	Logout(tc)
	_, _, err := runTrack(tc, fu, "t_bob", sigVersion)
	require.Error(t, err)
	_, ok := err.(libkb.DeviceRequiredError)
	require.True(t, ok)

	fu.LoginOrBust(tc)
	trackBob(tc, fu, sigVersion)
	defer untrackBob(tc, fu, sigVersion)

	// try tracking a user with no keys (which is now allowed)
	_, _, err = runTrack(tc, fu, "t_ellen", sigVersion)
	require.NoError(t, err)
}

// tests tracking a user that doesn't have a public key (#386)
func TestTrackNoPubKey(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)
	fu := CreateAndSignupFakeUser(tc, "track")
	Logout(tc)

	tracker := CreateAndSignupFakeUser(tc, "track")
	_, _, err := runTrack(tc, tracker, fu.Username, sigVersion)
	require.NoError(t, err)
}

func TestTrackMultiple(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)
	fu := CreateAndSignupFakeUser(tc, "track")

	trackAlice(tc, fu, sigVersion)
	defer untrackAlice(tc, fu, sigVersion)

	trackAlice(tc, fu, sigVersion)
}

func TestTrackNewUserWithPGP(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)
	fu := createFakeUserWithPGPSibkey(tc)
	Logout(tc)

	tracker := CreateAndSignupFakeUser(tc, "track")
	t.Logf("first track:")
	runTrack(tc, tracker, fu.Username, sigVersion)

	t.Logf("second track:")
	runTrack(tc, tracker, fu.Username, sigVersion)
}

// see issue #578
func TestTrackRetrack(t *testing.T) {

	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)
	fu := createFakeUserWithPGPSibkey(tc)

	idUI := &FakeIdentifyUI{}
	secretUI := fu.NewSecretUI()

	var err error
	fu.User, err = libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(tc.G))
	require.NoError(t, err)
	seqnoBefore := fu.User.GetSigChainLastKnownSeqno()

	sv := keybase1.SigVersion(sigVersion)
	arg := &TrackEngineArg{
		UserAssertion: "t_alice",
		Options:       keybase1.TrackOptions{BypassConfirm: true, SigVersion: &sv},
	}
	uis := libkb.UIs{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   secretUI,
	}
	eng := NewTrackEngine(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err = RunEngine2(m, eng)
	require.NoError(t, err)

	fu.User, err = libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(tc.G))
	require.NoError(t, err)
	seqnoAfter := fu.User.GetSigChainLastKnownSeqno()

	require.NotEqual(t, seqnoAfter, seqnoBefore)

	eng = NewTrackEngine(tc.G, arg)
	err = RunEngine2(m, eng)
	require.NoError(t, err)

	fu.User, err = libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(tc.G))
	require.NoError(t, err)
	seqnoRetrack := fu.User.GetSigChainLastKnownSeqno()

	require.False(t, seqnoRetrack > seqnoAfter)
}

func TestTrackLocal(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	_, them, err := runTrackWithOptions(tc, fu, "t_alice", keybase1.TrackOptions{LocalOnly: true, BypassConfirm: true}, fu.NewSecretUI(), false)
	require.NoError(t, err)

	require.NotNil(t, them)

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	require.NoError(t, err)

	m := NewMetaContextForTest(tc)
	s, err := me.TrackChainLinkFor(m, them.GetNormalizedName(), them.GetUID())
	require.NoError(t, err)
	require.NotNil(t, s)
	require.False(t, s.IsRemote())
}

// Make sure the track engine uses the secret store.
func TestTrackWithSecretStore(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testTrackWithSecretStore(t, sigVersion)
	})
}

func _testTrackWithSecretStore(t *testing.T, sigVersion libkb.SigVersion) {
	testEngineWithSecretStore(t, func(
		tc libkb.TestContext, fu *FakeUser, secretUI libkb.SecretUI) {
		trackAliceWithOptions(tc, fu, keybase1.TrackOptions{BypassConfirm: true}, secretUI)
		untrackAlice(tc, fu, sigVersion)
	})
}

// Test for Core-2196 identify/track race detection
func TestIdentifyTrackRaceDetection(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testIdentifyTrackRaceDetection(t, sigVersion)
	})
}

func _testIdentifyTrackRaceDetection(t *testing.T, sigVersion libkb.SigVersion) {
	user, dev1, dev2, cleanup := SetupTwoDevices(t, "track")
	defer cleanup()

	trackee := "t_tracy"

	doID := func(tc libkb.TestContext, fui *FakeIdentifyUI) {

		iarg := &keybase1.Identify2Arg{
			UserAssertion: trackee,
			// We need to block on identification so that the track token
			// is delivered to the UI before we return. Otherwise, the
			// following call to track might happen before the token
			// is known.
			AlwaysBlock:      true,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CLI,
		}
		eng := NewResolveThenIdentify2(tc.G, iarg)
		uis := libkb.UIs{IdentifyUI: fui}
		m := NewMetaContextForTest(tc).WithUIs(uis)
		err := RunEngine2(m, eng)
		require.NoError(t, err)
	}

	sv := keybase1.SigVersion(sigVersion)
	track := func(tc libkb.TestContext, fui *FakeIdentifyUI) error {
		arg := TrackTokenArg{
			Token: fui.Token,
			Options: keybase1.TrackOptions{
				BypassConfirm: true,
				ForceRetrack:  true,
				SigVersion:    &sv,
			},
		}
		uis := libkb.UIs{
			LogUI:    tc.G.UI.GetLogUI(),
			SecretUI: user.NewSecretUI(),
		}
		eng := NewTrackToken(tc.G, &arg)
		m := NewMetaContextForTest(tc).WithUIs(uis)
		return RunEngine2(m, eng)
	}

	trackSucceed := func(tc libkb.TestContext, fui *FakeIdentifyUI) {
		err := track(tc, fui)
		require.NoError(tc.T, err)
		assertTracking(dev1, trackee)
	}

	trackFail := func(tc libkb.TestContext, fui *FakeIdentifyUI, firstTrack bool) {
		err := track(tc, fui)
		require.Error(tc.T, err)
		tse, ok := err.(libkb.TrackStaleError)
		require.True(tc.T, ok)
		require.Equal(tc.T, tse.FirstTrack, firstTrack)
	}

	for i := 0; i < 2; i++ {
		fui1 := &FakeIdentifyUI{}
		fui2 := &FakeIdentifyUI{}
		doID(dev1, fui1)
		if i > 0 {
			// Device2 won't know that device1 made a change to the ME user
			// in time to make this test pass. So we hack in an invalidation.
			// We might have used the fact the userchanged notifications are bounced
			// off of the server, but that might slow down this test, so do the
			// simple and non-flakey thing.
			dev2.G.GetUPAKLoader().Invalidate(nil, libkb.UsernameToUID(user.Username))
		}
		doID(dev2, fui2)
		trackSucceed(dev1, fui1)
		trackFail(dev2, fui2, (i == 0))
	}

	runUntrack(dev1, user, trackee, sigVersion)
}

func TestTrackNoKeys(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)
	nk, pp := createFakeUserWithNoKeys(tc)
	Logout(tc)

	fu := CreateAndSignupFakeUser(tc, "track")
	trackUser(tc, fu, libkb.NewNormalizedUsername(nk), sigVersion)

	// provision nk on a new device
	Logout(tc)
	nku := &FakeUser{Username: nk, Passphrase: pp}
	err := nku.Login(tc.G)
	require.NoError(t, err)
	Logout(tc)

	// track nk again
	err = fu.Login(tc.G)
	require.NoError(t, err)
	ui := trackUserGetUI(tc, fu, libkb.NewNormalizedUsername(nk), sigVersion)

	// ensure track diff for new eldest key
	require.Equal(t, 1, len(ui.DisplayKeyDiffs))
	require.Equal(t, ui.DisplayKeyDiffs[0].Type, keybase1.TrackDiffType_NEW_ELDEST)
}

func TestTrackSelf(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()

	sigVersion := libkb.GetDefaultSigVersion(tc.G)
	sv := keybase1.SigVersion(sigVersion)
	fu := CreateAndSignupFakeUser(tc, "track")
	_, _, err := runTrackWithOptions(tc, fu, fu.NormalizedUsername().String(), keybase1.TrackOptions{
		BypassConfirm: true,
		SigVersion:    &sv,
	}, fu.NewSecretUI(), false)
	require.Error(t, err)
	require.Equal(t, "You can't follow yourself.", err.Error())
}

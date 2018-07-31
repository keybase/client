// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

const aliceFp string = "2373fd089f28f328916b88f99c7927c0bdfdadf9"
const bobFp string = "91fe9b24ef6706b1f7898f2059a2a43f8b731f29"

func createUserWhoTracks(tc libkb.TestContext, trackedUsers []string, sigVersion libkb.SigVersion) *FakeUser {
	fu := CreateAndSignupFakeUser(tc, "pull")
	fu.LoginOrBust(tc)

	for _, trackedUser := range trackedUsers {
		_, _, err := runTrack(tc, fu, trackedUser, sigVersion)
		require.NoError(tc.T, err, "error while tracking")
	}
	return fu
}

func untrackUserList(tc libkb.TestContext, fu *FakeUser, trackedUsers []string, sigVersion libkb.SigVersion) {
	for _, trackedUser := range trackedUsers {
		err := runUntrack(tc, fu, trackedUser, sigVersion)
		require.NoError(tc.T, err, "error while untracking %s", trackedUser)
	}
}

func createGpgClient(tc libkb.TestContext) *libkb.GpgCLI {
	gpgClient := libkb.NewGpgCLI(tc.G, tc.G.UI.GetLogUI())
	err := gpgClient.Configure()
	require.NoError(tc.T, err, "Error while configuring gpg client.")
	return gpgClient
}

func assertKeysPresent(t *testing.T, gpgClient *libkb.GpgCLI, fingerprints []string) {
	for _, fingerprint := range fingerprints {
		fpObj, err := gpgClient.ImportKey(false /*secret*/, *libkb.PGPFingerprintFromHexNoError(fingerprint), "")
		require.NoError(t, err, "Should have fingerprint in keyring: %s", fingerprint)
		require.Equal(t, fingerprint, fpObj.GetFingerprint().String())
	}
}

func assertKeysMissing(t *testing.T, gpgClient *libkb.GpgCLI, fingerprints []string) {
	for _, fingerprint := range fingerprints {
		_, err := gpgClient.ImportKey(false /*secret*/, *libkb.PGPFingerprintFromHexNoError(fingerprint), "")
		require.Error(t, err, "Should not already have fingerprint in keyring: %s", fingerprint)
	}
}

func runPGPPull(tc libkb.TestContext, arg PGPPullEngineArg) {
	eng := NewPGPPullEngine(tc.G, &arg)
	m := NewMetaContextForTestWithLogUI(tc)
	err := RunEngine2(m, eng)
	require.NoError(tc.T, err, "Error in PGPPullEngine")
}

func runPGPPullExpectingError(tc libkb.TestContext, arg PGPPullEngineArg) {
	eng := NewPGPPullEngine(tc.G, &arg)
	m := NewMetaContextForTestWithLogUI(tc)
	err := RunEngine2(m, eng)
	require.Error(tc.T, err, "PGPPullEngine should have failed.")
}

func TestPGPPullAll(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_pull")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)

	users := []string{"t_alice", "t_bob"}
	fu := createUserWhoTracks(tc, users, sigVersion)
	defer untrackUserList(tc, fu, users, sigVersion)
	gpgClient := createGpgClient(tc)

	assertKeysMissing(t, gpgClient, []string{aliceFp, bobFp})

	runPGPPull(tc, PGPPullEngineArg{})

	assertKeysPresent(t, gpgClient, []string{aliceFp, bobFp})
}

func TestPGPPullOne(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_pull")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)

	users := []string{"t_alice", "t_bob"}
	fu := createUserWhoTracks(tc, users, sigVersion)
	defer untrackUserList(tc, fu, users, sigVersion)
	gpgClient := createGpgClient(tc)

	assertKeysMissing(t, gpgClient, []string{aliceFp, bobFp})

	runPGPPull(tc, PGPPullEngineArg{
		// ID'ing the same user twice should be ok.
		UserAsserts: []string{"t_bob", "t_bob+kbtester1@twitter"},
	})

	assertKeysPresent(t, gpgClient, []string{bobFp})
	assertKeysMissing(t, gpgClient, []string{aliceFp})
}

func TestPGPPullBadIDs(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_pull")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)

	users := []string{"t_alice", "t_bob"}
	fu := createUserWhoTracks(tc, users, sigVersion)
	defer untrackUserList(tc, fu, users, sigVersion)
	gpgClient := createGpgClient(tc)

	assertKeysMissing(t, gpgClient, []string{aliceFp, bobFp})

	runPGPPullExpectingError(tc, PGPPullEngineArg{
		// ID'ing invalid user should fail the pull.
		UserAsserts: []string{"t_bob", "t_NOT_TRACKED_BY_ME"},
	})

	assertKeysMissing(t, gpgClient, []string{aliceFp, bobFp})
}

func TestPGPPullNotTracked(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_pull")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)

	// Only tracking alice
	users := []string{"t_alice"}
	fu := createUserWhoTracks(tc, users, sigVersion)
	defer untrackUserList(tc, fu, users, sigVersion)
	gpgClient := createGpgClient(tc)

	// But want to pull bot alice and bob.
	assertKeysMissing(t, gpgClient, []string{aliceFp, bobFp})

	fui := &FakeIdentifyUI{FakeConfirm: true}
	uis := libkb.UIs{
		LogUI:      tc.G.UI.GetLogUI(),
		GPGUI:      &gpgtestui{},
		IdentifyUI: fui,
	}
	eng := NewPGPPullEngine(tc.G, &PGPPullEngineArg{
		UserAsserts: []string{"t_bob", "t_alice"},
	})
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.NoError(t, err)
	require.Equal(t, 1, fui.StartCount, "Expected 1 ID UI prompt")

	assertKeysPresent(t, gpgClient, []string{bobFp, aliceFp})
}

func TestPGPPullNotLoggedIn(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()

	gpgClient := createGpgClient(tc)

	assertKeysMissing(t, gpgClient, []string{aliceFp, bobFp})

	fui := &FakeIdentifyUI{FakeConfirm: true}
	uis := libkb.UIs{
		LogUI:      tc.G.UI.GetLogUI(),
		GPGUI:      &gpgtestui{},
		IdentifyUI: fui,
	}
	eng := NewPGPPullEngine(tc.G, &PGPPullEngineArg{
		UserAsserts: []string{"t_bob", "t_alice"},
	})
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.NoError(t, err)
	require.Equal(t, 2, fui.StartCount, "Expected 2 ID UI prompt")

	assertKeysPresent(t, gpgClient, []string{aliceFp, bobFp})
}

func TestPGPPullMultiplePrompts(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_pull")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)
	createUserWhoTracks(tc, []string{}, sigVersion)

	gpgClient := createGpgClient(tc)
	assertKeysMissing(t, gpgClient, []string{aliceFp})

	// Try the first time, declining in prompt. We expect keys not to
	// be imported.
	fui := &FakeIdentifyUI{FakeConfirm: false}
	uis := libkb.UIs{
		LogUI:      tc.G.UI.GetLogUI(),
		GPGUI:      &gpgtestui{},
		IdentifyUI: fui,
	}

	eng := NewPGPPullEngine(tc.G, &PGPPullEngineArg{
		UserAsserts: []string{"t_alice"},
	})
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.NoError(t, err)

	require.Equal(t, 1, fui.StartCount, "Expected 1 ID UI prompt")
	assertKeysMissing(t, gpgClient, []string{aliceFp})

	// Run again, declining like before, but make sure we got asked
	// second time and our answer wasn't just cached.
	err = RunEngine2(m, eng)
	require.NoError(t, err)

	require.Equal(t, 2, fui.StartCount, "Expected 2 ID UI prompts")
	assertKeysMissing(t, gpgClient, []string{aliceFp})

	// Run again, attempt to confirm in prompt. PGP Pull should ask us
	// again even though we declined before, and successfully import
	// the keys.
	fui.FakeConfirm = true
	err = RunEngine2(m, eng)
	require.NoError(t, err)

	require.Equal(t, 3, fui.StartCount, "Expected 2 ID UI prompts")
	assertKeysPresent(t, gpgClient, []string{aliceFp})
}

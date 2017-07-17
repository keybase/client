// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

const aliceFp string = "2373fd089f28f328916b88f99c7927c0bdfdadf9"
const bobFp string = "91fe9b24ef6706b1f7898f2059a2a43f8b731f29"

func createUserWhoTracks(tc libkb.TestContext, trackedUsers []string) *FakeUser {
	fu := CreateAndSignupFakeUser(tc, "pull")
	fu.LoginOrBust(tc)

	for _, trackedUser := range trackedUsers {
		_, _, err := runTrack(tc, fu, trackedUser)
		if err != nil {
			tc.T.Fatal("Error while tracking", trackedUser, err)
		}
	}
	return fu
}

func untrackUserList(tc libkb.TestContext, fu *FakeUser, trackedUsers []string) {
	for _, trackedUser := range trackedUsers {
		if err := runUntrack(tc.G, fu, trackedUser); err != nil {
			tc.T.Fatal("Error while untracking", trackedUser, err)
		}
	}
}

func createGpgClient(tc libkb.TestContext) *libkb.GpgCLI {
	gpgClient := libkb.NewGpgCLI(tc.G, tc.G.UI.GetLogUI())
	err := gpgClient.Configure()
	if err != nil {
		tc.T.Fatal("Error while configuring gpg client.")
	}
	return gpgClient
}

func assertKeysPresent(t *testing.T, gpgClient *libkb.GpgCLI, fingerprints []string) {
	for _, fingerprint := range fingerprints {
		fpObj, err := gpgClient.ImportKey(false /*secret*/, *libkb.PGPFingerprintFromHexNoError(fingerprint), "")
		if err != nil {
			t.Fatal("Should have fingerprint in keyring:", fingerprint)
		}
		if fingerprint != fpObj.GetFingerprint().String() {
			t.Fatal("Expected to import a different fingerprint:", fingerprint, fpObj.GetFingerprint())
		}
	}
}

func assertKeysMissing(t *testing.T, gpgClient *libkb.GpgCLI, fingerprints []string) {
	for _, fingerprint := range fingerprints {
		_, err := gpgClient.ImportKey(false /*secret*/, *libkb.PGPFingerprintFromHexNoError(fingerprint), "")
		if err == nil {
			t.Fatal("Should not already have fingerprint in keyring:", fingerprint)
		}
	}
}

func runPGPPull(tc libkb.TestContext, arg PGPPullEngineArg) {
	eng := NewPGPPullEngine(&arg, tc.G)
	ctx := Context{
		LogUI: tc.G.UI.GetLogUI(),
	}
	err := RunEngine(eng, &ctx)
	if err != nil {
		tc.T.Fatal("Error in PGPPullEngine:", err)
	}
}

func runPGPPullExpectingError(tc libkb.TestContext, arg PGPPullEngineArg) {
	eng := NewPGPPullEngine(&arg, tc.G)
	ctx := Context{
		LogUI: tc.G.UI.GetLogUI(),
	}
	err := RunEngine(eng, &ctx)
	if err == nil {
		tc.T.Fatal("PGPPullEngine should have failed.")
	}
}

func TestPGPPullAll(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_pull")
	defer tc.Cleanup()

	users := []string{"t_alice", "t_bob"}
	fu := createUserWhoTracks(tc, users)
	defer untrackUserList(tc, fu, users)
	gpgClient := createGpgClient(tc)

	assertKeysMissing(t, gpgClient, []string{aliceFp, bobFp})

	runPGPPull(tc, PGPPullEngineArg{})

	assertKeysPresent(t, gpgClient, []string{aliceFp, bobFp})
}

func TestPGPPullOne(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_pull")
	defer tc.Cleanup()

	users := []string{"t_alice", "t_bob"}
	fu := createUserWhoTracks(tc, users)
	defer untrackUserList(tc, fu, users)
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

	users := []string{"t_alice", "t_bob"}
	fu := createUserWhoTracks(tc, users)
	defer untrackUserList(tc, fu, users)
	gpgClient := createGpgClient(tc)

	assertKeysMissing(t, gpgClient, []string{aliceFp, bobFp})

	runPGPPullExpectingError(tc, PGPPullEngineArg{
		// ID'ing a nonexistent/untracked user should fail the pull.
		UserAsserts: []string{"t_bob", "t_NOT_TRACKED_BY_ME"},
	})

	assertKeysMissing(t, gpgClient, []string{aliceFp, bobFp})
}

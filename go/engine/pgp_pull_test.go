package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

const aliceFp string = "2373fd089f28f328916b88f99c7927c0bdfdadf9"
const bobFp string = "91fe9b24ef6706b1f7898f2059a2a43f8b731f29"

func createUserWhoTracks(t *testing.T, trackedUsers []string) *FakeUser {
	fu := CreateAndSignupFakeUser(t, "pull")
	fu.LoginOrBust(t)

	for _, trackedUser := range trackedUsers {
		_, _, err := runTrack(fu, trackedUser)
		if err != nil {
			t.Fatal("Error while tracking", trackedUser, err)
		}
	}
	return fu
}

func untrackUserList(t *testing.T, fu *FakeUser, trackedUsers []string) {
	for _, trackedUser := range trackedUsers {
		if err := runUntrack(fu, trackedUser); err != nil {
			t.Fatal("Error while untracking", trackedUser, err)
		}
	}
}

func createGpgClient(t *testing.T) *libkb.GpgCLI {
	gpgClient := libkb.NewGpgCLI(libkb.GpgCLIArg{
		LogUI: G.UI.GetLogUI(),
	})
	_, err := gpgClient.Configure()
	if err != nil {
		t.Fatal("Error while configuring gpg client.")
	}
	return gpgClient
}

func assertKeysPresent(t *testing.T, gpgClient *libkb.GpgCLI, fingerprints []string) {
	for _, fingerprint := range fingerprints {
		fpObj, err := gpgClient.ImportKey(false /*secret*/, *libkb.PgpFingerprintFromHexNoError(fingerprint))
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
		_, err := gpgClient.ImportKey(false /*secret*/, *libkb.PgpFingerprintFromHexNoError(fingerprint))
		if err == nil {
			t.Fatal("Should not already have fingerprint in keyring:", fingerprint)
		}
	}
}

func runPgpPull(t *testing.T, arg PGPPullEngineArg) {
	eng := NewPGPPullEngine(&arg, G)
	ctx := Context{
		LogUI: G.UI.GetLogUI(),
	}
	err := RunEngine(eng, &ctx)
	if err != nil {
		t.Fatal("Error in PGPPullEngine:", err)
	}
}

func runPgpPullExpectingError(t *testing.T, arg PGPPullEngineArg) {
	eng := NewPGPPullEngine(&arg, G)
	ctx := Context{
		LogUI: G.UI.GetLogUI(),
	}
	err := RunEngine(eng, &ctx)
	if err == nil {
		t.Fatal("PGPPullEngine should have failed.")
	}
}

func TestPGPPullAll(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_pull")
	defer tc.Cleanup()

	users := []string{"t_alice", "t_bob"}
	fu := createUserWhoTracks(t, users)
	defer untrackUserList(t, fu, users)
	gpgClient := createGpgClient(t)

	assertKeysMissing(t, gpgClient, []string{aliceFp, bobFp})

	runPgpPull(t, PGPPullEngineArg{})

	assertKeysPresent(t, gpgClient, []string{aliceFp, bobFp})
}

func TestPGPPullOne(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_pull")
	defer tc.Cleanup()

	users := []string{"t_alice", "t_bob"}
	fu := createUserWhoTracks(t, users)
	defer untrackUserList(t, fu, users)
	gpgClient := createGpgClient(t)

	assertKeysMissing(t, gpgClient, []string{aliceFp, bobFp})

	runPgpPull(t, PGPPullEngineArg{
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
	fu := createUserWhoTracks(t, users)
	defer untrackUserList(t, fu, users)
	gpgClient := createGpgClient(t)

	assertKeysMissing(t, gpgClient, []string{aliceFp, bobFp})

	runPgpPullExpectingError(t, PGPPullEngineArg{
		// ID'ing a nonexistent/untracked user should fail the pull.
		UserAsserts: []string{"t_bob", "t_NOT_TRACKED_BY_ME"},
	})

	assertKeysMissing(t, gpgClient, []string{aliceFp, bobFp})
}

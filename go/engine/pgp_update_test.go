package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/openpgp"
)

func doUpdate(fingerprints []string, all bool, tc libkb.TestContext) (err error) {
	eng := NewPGPUpdateEngine(fingerprints, all, tc.G)
	ctx := Context{
		LogUI: tc.G.UI.GetLogUI(),
	}
	err = RunEngine(eng, &ctx)
	return
}

func getFakeUsersKeyBundleFromServer(t *testing.T, fu *FakeUser) *libkb.PgpKeyBundle {
	user, err := libkb.LoadUser(libkb.LoadUserArg{
		Name:        fu.Username,
		ForceReload: true,
	})
	if err != nil {
		t.Fatal("Failed loading user", err)
	}
	ckf := user.GetComputedKeyFamily()
	keys := ckf.GetActivePgpKeys(true /* sibkeys */)
	if len(keys) != 1 {
		t.Fatal("Expected only one key.")
	}
	return keys[0]
}

func TestPGPUpdate(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_update")
	defer tc.Cleanup()

	fakeUser := createFakeUserWithPGPOnly(t, tc)
	bundle := getFakeUsersKeyBundleFromServer(t, fakeUser)
	if len(bundle.Subkeys) != 1 {
		t.Fatal("expected exactly 1 subkey")
	}

	// Modify the key by deleting the subkey.
	bundle.Subkeys = []openpgp.Subkey{}

	gpgCLI := libkb.NewGpgCLI(libkb.GpgCLIArg{
		LogUI: tc.G.UI.GetLogUI(),
	})
	_, err := gpgCLI.Configure()
	if err != nil {
		t.Fatal("erorr initializing GpgCLI", err)
	}

	// Add the modified key to the gpg keyring
	gpgCLI.ExportKey(*bundle)

	// Now run `client pgp update` with a fingerprint that doesn't match.
	err = doUpdate([]string{"not_a_real_fingerprint"}, false, tc)
	if err != nil {
		t.Fatal("Error in PGPUpdateEngine:", err)
	}
	// Load the user from the server again.
	reloadedBundle := getFakeUsersKeyBundleFromServer(t, fakeUser)
	// Check that the key hasn't been modified.
	if len(reloadedBundle.Subkeys) != 1 {
		t.Fatal("Key changes should not have been uploaded.")
	}

	// Do the same thing without the fingerprint. It should go through this time.
	err = doUpdate([]string{}, false, tc)
	if err != nil {
		t.Fatal("Error in PGPUpdateEngine:", err)
	}
	// Load the user from the server again.
	reloadedBundle = getFakeUsersKeyBundleFromServer(t, fakeUser)
	// Check that the key hasn't been modified.
	if len(reloadedBundle.Subkeys) != 0 {
		t.Fatal("Key changes should have been uploaded.")
	}
}

func TestPGPUpdateMultiKey(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_update")
	defer tc.Cleanup()

	createFakeUserWithPGPMult(t, tc)

	// `client pgp update` should fail by default, because there are multiple keys.
	err := doUpdate([]string{}, false /* all */, tc)
	if err == nil {
		t.Fatal("Update should fail with multiple keys and no --all.")
	}

	// `client pgp update` should fail with both specific fingerprints and --all.
	err = doUpdate([]string{"foo"}, true /* all */, tc)
	if err == nil {
		t.Fatal("Update should fail with explicit fingerprint and --all.")
	}

	// It should finally succeed with just --all.
	err = doUpdate([]string{}, true /* all */, tc)
	if err != nil {
		t.Fatal("Update should succeed with --all.")
	}
}

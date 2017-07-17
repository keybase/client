// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-crypto/openpgp"
)

func doUpdate(fingerprints []string, all bool, fu *FakeUser, tc libkb.TestContext) (err error) {
	eng := NewPGPUpdateEngine(fingerprints, all, tc.G)
	ctx := Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	err = RunEngine(eng, &ctx)
	return
}

func getFakeUsersKeyBundleFromServer(tc libkb.TestContext, fu *FakeUser) *libkb.PGPKeyBundle {
	arg := libkb.NewLoadUserForceArg(tc.G)
	arg.Name = fu.Username
	user, err := libkb.LoadUser(arg)
	if err != nil {
		tc.T.Fatal("Failed loading user", err)
	}
	ckf := user.GetComputedKeyFamily()
	keys := ckf.GetActivePGPKeys(true /* sibkeys */)
	if len(keys) != 1 {
		tc.T.Fatal("Expected only one key.")
	}
	return keys[0]
}

func getFakeUsersBundlesList(tc libkb.TestContext, fu *FakeUser) []string {
	arg := libkb.NewLoadUserForceArg(tc.G)
	arg.Name = fu.Username
	user, err := libkb.LoadUser(arg)
	if err != nil {
		tc.T.Fatal("Failed loading user", err)
	}
	return user.GetKeyFamily().BundlesForTesting
}

func TestPGPUpdate(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_update")
	defer tc.Cleanup()

	// Note that this user's key is not created in the GPG keyring. For the
	// purposes of this test that's ok.
	fakeUser := createFakeUserWithPGPSibkey(tc)
	bundle := getFakeUsersKeyBundleFromServer(tc, fakeUser)
	if len(bundle.Subkeys) != 1 {
		t.Fatal("expected exactly 1 subkey")
	}
	originalBundlesLen := len(getFakeUsersBundlesList(tc, fakeUser))

	// Modify the key by deleting the subkey.
	bundle.Subkeys = []openpgp.Subkey{}

	gpgCLI := libkb.NewGpgCLI(tc.G, tc.G.UI.GetLogUI())
	err := gpgCLI.Configure()
	if err != nil {
		t.Fatal("Error initializing GpgCLI", err)
	}

	// Add the modified key to the gpg keyring
	if err := gpgCLI.ExportKey(*bundle, false /* export public key only */); err != nil {
		t.Fatal(err)
	}

	// Now run `client pgp update` with a fingerprint that doesn't match.
	err = doUpdate([]string{"not_a_real_fingerprint"}, false, fakeUser, tc)
	if err != nil {
		t.Fatal("Error in PGPUpdateEngine:", err)
	}
	// Get the list of bundles from the server.
	bundles := getFakeUsersBundlesList(tc, fakeUser)
	// Check that the key hasn't been modified.
	if len(bundles) != originalBundlesLen {
		t.Fatal("Key changes should not have been uploaded.")
	}

	// Do the same thing without the fingerprint. It should go through this time.
	err = doUpdate([]string{}, false, fakeUser, tc)
	if err != nil {
		t.Fatal("Error in PGPUpdateEngine:", err)
	}
	// Load the user from the server again.
	reloadedBundles := getFakeUsersBundlesList(tc, fakeUser)
	// Check that the key hasn't been modified.
	if len(reloadedBundles) != originalBundlesLen+1 {
		t.Fatal("Key changes should have been uploaded.")
	}
}

func TestPGPUpdateMultiKey(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_update")
	defer tc.Cleanup()

	// Get a user with one PGP sibkey. Note that this user's key is not created
	// in the GPG keyring. For the purposes of this test that's ok.
	fu := createFakeUserWithPGPSibkey(tc)

	// Generate a second PGP sibkey.
	arg := PGPKeyImportEngineArg{
		AllowMulti: true,
		DoExport:   true,
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
	}
	arg.Gen.MakeAllIds()
	ctx := Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewPGPKeyImportEngine(arg)
	err := RunEngine(eng, &ctx)
	if err != nil {
		tc.T.Fatal(err)
	}

	// `client pgp update` should fail by default, because there are multiple keys.
	err = doUpdate([]string{}, false /* all */, fu, tc)
	if err == nil {
		t.Fatal("Update should fail with multiple keys and no --all.")
	}

	// `client pgp update` should fail with both specific fingerprints and --all.
	err = doUpdate([]string{"foo"}, true /* all */, fu, tc)
	if err == nil {
		t.Fatal("Update should fail with explicit fingerprint and --all.")
	}

	// It should finally succeed with just --all.
	err = doUpdate([]string{}, true /* all */, fu, tc)
	if err != nil {
		t.Fatal("Update should succeed with --all. Error:", err)
	}
}

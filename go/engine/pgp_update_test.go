// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-crypto/openpgp"
	"github.com/stretchr/testify/require"
)

func doUpdate(fingerprints []string, all bool, fu *FakeUser, tc libkb.TestContext) (err error) {
	eng := NewPGPUpdateEngine(tc.G, fingerprints, all)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err = RunEngine2(m, eng)
	return
}

func getFakeUsersKeyBundleFromServer(tc libkb.TestContext, fu *FakeUser) *libkb.PGPKeyBundle {
	arg := libkb.NewLoadUserForceArg(tc.G).WithName(fu.Username)
	user, err := libkb.LoadUser(arg)
	require.NoError(tc.T, err, fmt.Sprint("Failed loading user", err))
	ckf := user.GetComputedKeyFamily()
	keys := ckf.GetActivePGPKeys(true /* sibkeys */)
	require.Len(tc.T, keys, 1, "Expected only one key.")
	return keys[0]
}

func getFakeUsersBundlesList(tc libkb.TestContext, fu *FakeUser) []string {
	arg := libkb.NewLoadUserForceArg(tc.G).WithName(fu.Username)
	user, err := libkb.LoadUser(arg)
	require.NoError(tc.T, err, fmt.Sprint("Failed loading user", err))
	return user.GetKeyFamily().BundlesForTesting
}

func TestPGPUpdate(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_update")
	defer tc.Cleanup()

	// Note that this user's key is not created in the GPG keyring. For the
	// purposes of this test that's ok.
	fakeUser := createFakeUserWithPGPSibkey(tc)
	bundle := getFakeUsersKeyBundleFromServer(tc, fakeUser)
	require.Len(t, bundle.Subkeys, 1, "expected exactly 1 subkey")
	originalBundlesLen := len(getFakeUsersBundlesList(tc, fakeUser))

	// Modify the key by deleting the subkey.
	bundle.Subkeys = []openpgp.Subkey{}

	gpgCLI := libkb.NewGpgCLI(tc.G, tc.G.UI.GetLogUI())
	err := gpgCLI.Configure(tc.MetaContext())
	require.NoError(t, err, fmt.Sprint("Error initializing GpgCLI", err))

	// Add the modified key to the gpg keyring
	if err := gpgCLI.ExportKey(tc.MetaContext(), *bundle, false /* export public key only */, false /* no batch mode */); err != nil {
		require.NoError(t, err)
	}

	// Now run `client pgp update` with a fingerprint that doesn't match.
	err = doUpdate([]string{"not_a_real_fingerprint"}, false, fakeUser, tc)
	require.NoError(t, err, fmt.Sprint("Error in PGPUpdateEngine:", err))
	// Get the list of bundles from the server.
	bundles := getFakeUsersBundlesList(tc, fakeUser)
	// Check that the key hasn't been modified.
	require.Len(t, bundles, originalBundlesLen, "Key changes should not have been uploaded.")

	// Do the same thing without the fingerprint. It should go through this time.
	err = doUpdate([]string{}, false, fakeUser, tc)
	require.NoError(t, err, fmt.Sprint("Error in PGPUpdateEngine:", err))
	// Load the user from the server again.
	reloadedBundles := getFakeUsersBundlesList(tc, fakeUser)
	// Check that the key hasn't been modified.
	require.Len(t, reloadedBundles, originalBundlesLen+1, "Key changes should have been uploaded.")
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
	err := arg.Gen.MakeAllIDs(tc.G)
	require.NoError(tc.T, err)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewPGPKeyImportEngine(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err = RunEngine2(m, eng)
	require.NoError(tc.T, err)

	// `client pgp update` should fail by default, because there are multiple keys.
	err = doUpdate([]string{}, false /* all */, fu, tc)
	require.Error(t, err,
		"Update should fail with multiple keys and no --all.")

	// `client pgp update` should fail with both specific fingerprints and --all.
	err = doUpdate([]string{"foo"}, true /* all */, fu, tc)
	require.Error(t, err,
		"Update should fail with explicit fingerprint and --all.")

	// It should finally succeed with just --all.
	err = doUpdate([]string{}, true /* all */, fu, tc)
	require.NoError(t, err, fmt.Sprint("Update should succeed with --all. Error:", err))
}

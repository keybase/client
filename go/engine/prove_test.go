// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestProveRooter(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testProveRooter(t, sigVersion)
	})
}

func _testProveRooter(t *testing.T, sigVersion libkb.SigVersion) {
	tc := SetupEngineTest(t, "prove")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "prove")

	proveUI, _, err := proveRooter(tc.G, fu, sigVersion)
	require.NoError(t, err)

	require.False(t, proveUI.overwrite)
	require.False(t, proveUI.warning)
	require.False(t, proveUI.recheck)
	require.True(t, proveUI.checked)
}

// Make sure the prove engine uses the secret store.
func TestProveRooterWithSecretStore(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testProveRooterWithSecretStore(t, sigVersion)
	})
}

func _testProveRooterWithSecretStore(t *testing.T, sigVersion libkb.SigVersion) {
	testEngineWithSecretStore(t, func(
		tc libkb.TestContext, fu *FakeUser, secretUI libkb.SecretUI) {
		_, _, err := proveRooterWithSecretUI(tc.G, fu, secretUI, sigVersion)
		require.NoError(t, err)
	})
}

// When device keys are cached, proofs shouldn't require passphrase prompt.
func TestProveRooterCachedKeys(t *testing.T) {
	tc := SetupEngineTest(t, "prove")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)

	fu := CreateAndSignupFakeUser(tc, "prove")
	clearCaches(tc.G)

	_, _, err := proveRooterWithSecretUI(tc.G, fu, &libkb.TestSecretUI{}, sigVersion)
	require.NoError(t, err)
}

func TestProveGenericSocial(t *testing.T) {
	tc := SetupEngineTest(t, "prove")
	defer tc.Cleanup()
	sigVersion := libkb.KeybaseSignatureV2

	fu := CreateAndSignupFakeUser(tc, "prove")
	proveGubbleSocial(tc, fu, sigVersion)
	proveGubbleCloud(tc, fu, sigVersion)
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
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

func TestProveGenericSocialTiming(t *testing.T) {
	tc := SetupEngineTest(t, "prove")
	defer tc.Cleanup()
	sigVersion := libkb.KeybaseSignatureV2

	fu := CreateAndSignupFakeUser(tc, "prove")
	proveGubbleUniverseSimple(tc, "gubble.social", "gubble_social", fu, sigVersion)

	res := runID3(t, mctx, alice.Username, true)
	require.False(t, res.userWasReset)

	// We get one row of results, just the cryptocurrency row.
	require.Equal(t, 1, len(res.rows))
	require.Equal(t, "btc", res.rows[0].Key)
	require.Equal(t, addr, res.rows[0].Value)
	require.Equal(t, keybase1.Identify3RowColor_GREEN, res.rows[0].Color)
	require.Equal(t, keybase1.Identify3RowState_VALID, res.rows[0].State)
}

func proveGubbleUniverseSimple(tc libkb.TestContext, serviceName, endpoint string, fu *FakeUser, sigVersion libkb.SigVersion) keybase1.SigID {
	tc.T.Logf("proof for %s", serviceName)
	g := tc.G
	sv := keybase1.SigVersion(sigVersion)
	proofService := g.GetProofServices().GetServiceType(serviceName)
	require.NotNil(tc.T, proofService)

	// Post a proof to the testing generic social service
	arg := keybase1.StartProofArg{
		Service:      proofService.GetTypeName(),
		Username:     fu.Username,
		Force:        false,
		PromptPosted: true,
		SigVersion:   &sv,
	}
	eng := NewProve(g, &arg)

	// Post the proof to the gubble network and verify the sig hash
	outputInstructionsHook := func(ctx context.Context, _ keybase1.OutputInstructionsArg) error {
		sigID := eng.sigID
		require.False(tc.T, sigID.IsNil())
		mctx := libkb.NewMetaContext(ctx, g)

		apiArg := libkb.APIArg{
			Endpoint:    fmt.Sprintf("gubble_universe/%s", endpoint),
			SessionType: libkb.APISessionTypeREQUIRED,
			Args: libkb.HTTPArgs{
				"sig_hash":      libkb.S{Val: sigID.String()},
				"username":      libkb.S{Val: fu.Username},
				"kb_username":   libkb.S{Val: fu.Username},
				"kb_ua":         libkb.S{Val: libkb.UserAgent},
				"json_redirect": libkb.B{Val: true},
			},
		}
		_, err := g.API.Post(libkb.NewMetaContext(ctx, g), apiArg)
		require.NoError(tc.T, err)
		return nil
	}

	proveUI := &ProveUIMock{outputInstructionsHook: outputInstructionsHook}
	uis := libkb.UIs{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
		ProveUI:  proveUI,
	}
	m := libkb.NewMetaContextTODO(g).WithUIs(uis)
	err := RunEngine2(m, eng)
	checkFailed(tc.T.(testing.TB))
	require.NoError(tc.T, err)
	require.False(tc.T, proveUI.overwrite)
	require.False(tc.T, proveUI.warning)
	require.False(tc.T, proveUI.recheck)
	require.True(tc.T, proveUI.checked)
	return eng.sigID
}

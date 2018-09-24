// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		tc := SetupEngineTest(t, "prove")
		defer tc.Cleanup()

		fu := CreateAndSignupFakeUser(tc, "prove")
		_testProveGubbleSocial(tc, fu, sigVersion)
	})
}

func _testProveGubbleSocial(tc libkb.TestContext, fu *FakeUser, sigVersion libkb.SigVersion) keybase1.SigID {
	g := tc.G
	sv := keybase1.SigVersion(sigVersion)
	proofService := g.GetProofServices().GetServiceType("gubble.social")
	require.NotNil(tc.T, proofService)

	// Post a proof to the testing generic social service, gubble.social
	arg := keybase1.StartProofArg{
		Service:      proofService.GetTypeName(),
		Username:     fu.Username,
		Force:        false,
		PromptPosted: true,
		SigVersion:   &sv,
	}
	eng := NewProve(g, &arg)

	// Post the proof the gubble network and verify the sig hash
	hook := func(arg keybase1.OkToCheckArg) (bool, string, error) {
		sigID := eng.sigID
		require.False(tc.T, sigID.IsNil())

		apiArg := libkb.APIArg{
			Endpoint:    "gubble_universe/gubble_social",
			SessionType: libkb.APISessionTypeREQUIRED,
			Args: libkb.HTTPArgs{
				"sig_hash":    libkb.S{Val: sigID.String()},
				"kb_username": libkb.S{Val: fu.Username},
			},
		}
		_, err := g.API.Post(apiArg)
		require.NoError(tc.T, err)

		apiArg = libkb.APIArg{
			Endpoint:    fmt.Sprintf("gubble_universe/gubble_social/%s/proofs", fu.Username),
			SessionType: libkb.APISessionTypeNONE,
		}

		res, err := g.GetAPI().Get(apiArg)
		require.NoError(tc.T, err)
		objects, err := libkb.AtSelectorPath(res.Body, []keybase1.SelectorEntry{
			keybase1.SelectorEntry{
				IsKey: true,
				Key:   "res",
			},
			keybase1.SelectorEntry{
				IsKey: true,
				Key:   "keybase_proofs",
			},
		}, tc.T.Logf)
		require.NoError(tc.T, err)
		require.Len(tc.T, objects, 1)

		var proofs []keybase1.ParamProofJSON
		err = objects[0].UnmarshalAgain(&proofs)
		require.NoError(tc.T, err)
		require.True(tc.T, len(proofs) >= 1)
		for _, proof := range proofs {
			if proof.KbUsername == fu.Username && sigID.Equal(proof.SigHash) {
				return true, proof.SigHash.String(), nil
			}
		}
		return false, "", fmt.Errorf("proof not found")
	}

	proveUI := &ProveUIMock{hook: hook}
	uis := libkb.UIs{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
		ProveUI:  proveUI,
	}
	m := libkb.NewMetaContextTODO(g).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.NoError(tc.T, err)
	require.False(tc.T, proveUI.overwrite)
	require.False(tc.T, proveUI.warning)
	require.False(tc.T, proveUI.recheck)
	require.True(tc.T, proveUI.checked)
	return eng.sigID
}

// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestPerUserKeyUpkeep(t *testing.T) {
	tc := SetupEngineTest(t, "pukup")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUserPaper(tc, "pukup")
	upkeep := func() *PerUserKeyUpkeep {
		arg := &PerUserKeyUpkeepArgs{}
		eng := NewPerUserKeyUpkeep(tc.G, arg)
		m := NewMetaContextForTestWithLogUI(tc)
		err := RunEngine2(m, eng)
		require.NoError(t, err)
		return eng
	}
	require.False(t, upkeep().DidRollKey, "don't roll")

	t.Logf("revoke paper key")
	revokeAnyPaperKey(tc, fu)

	require.False(t, upkeep().DidRollKey, "don't roll after revoke-other")

	t.Logf("provision second device")
	tcY, cleanup := provisionNewDeviceKex(&tc, fu)
	defer cleanup()

	t.Logf("second device deprovisions itself")
	{
		eng := NewDeprovisionEngine(tcY.G, fu.Username, true /* doRevoke */)
		uis := libkb.UIs{
			LogUI:    tcY.G.UI.GetLogUI(),
			SecretUI: fu.NewSecretUI(),
		}
		m := libkb.NewMetaContextTODO(tcY.G).WithUIs(uis)
		err := RunEngine2(m, eng)
		require.NoError(t, err, "deprovision")
	}

	t.Logf("load self to bust the upak cache")
	// Upkeep hits the cache. It's ok that upkeep doesn't notice a deprovision
	// right away. Bust the upak cache as a way of simulating time passing
	// for the sake of this test.
	loadArg := libkb.NewLoadUserArg(tc.G).
		WithUID(fu.UID()).
		WithSelf(true).
		WithForcePoll(true). // <-
		WithPublicKeyOptional()
	_, _, err := tc.G.GetUPAKLoader().LoadV2(loadArg)
	require.NoError(t, err)

	require.True(t, upkeep().DidRollKey, "roll after deprovision")

	require.False(t, upkeep().DidRollKey, "don't roll after just rolled")
}

// This engine no-ops when the user has no PUKs.
func TestPerUserKeyUpkeepNoPUK(t *testing.T) {
	tc := SetupEngineTest(t, "pukup")
	defer tc.Cleanup()
	tc.Tp.DisableUpgradePerUserKey = true

	_ = CreateAndSignupFakeUser(tc, "pukup")

	upkeep := func() *PerUserKeyUpkeep {
		arg := &PerUserKeyUpkeepArgs{}
		eng := NewPerUserKeyUpkeep(tc.G, arg)
		m := NewMetaContextForTestWithLogUI(tc)
		err := RunEngine2(m, eng)
		require.NoError(t, err)
		return eng
	}
	require.False(t, upkeep().DidRollKey, "no puk, no roll")

	checkPerUserKeyCountLocal(&tc, 0)
	checkPerUserKeyCount(&tc, 0)
}

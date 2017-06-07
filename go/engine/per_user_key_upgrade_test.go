// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestPerUserKeyUpgrade(t *testing.T) {
	tc := SetupEngineTest(t, "pukup")
	defer tc.Cleanup()

	tc.Tp.UpgradePerUserKey = false

	fu := CreateAndSignupFakeUserPaper(tc, "pukup")

	checkPerUserKeyCount(&tc, 0)

	tc.Tp.UpgradePerUserKey = true

	t.Logf("upgrade")
	upgrade := func() *PerUserKeyUpgrade {
		arg := &PerUserKeyUpgradeArgs{}
		eng := NewPerUserKeyUpgrade(tc.G, arg)
		ctx := &Context{
			LogUI: tc.G.UI.GetLogUI(),
		}
		err := RunEngine(eng, ctx)
		require.NoError(t, err)
		return eng
	}
	require.True(t, upgrade().DidNewKey, "created key")

	checkPerUserKeyCountLocal(&tc, 1)
	checkPerUserKeyCount(&tc, 1)

	t.Logf("revoke paper key")
	revokeAnyPaperKey(tc, fu)

	t.Logf("should be on gen 2")
	checkPerUserKeyCountLocal(&tc, 2)
	checkPerUserKeyCount(&tc, 2)

	t.Logf("run the upgrade engine again. Expect an error because the user is already up.")
	require.False(t, upgrade().DidNewKey, "did not create key")
}

func checkPerUserKeyCount(tc *libkb.TestContext, n int) {
	t := tc.T
	me, err := libkb.LoadMe(libkb.NewLoadUserForceArg(tc.G))
	require.NoError(t, err)
	require.Len(t, me.ExportToUserPlusKeys(keybase1.Time(0)).PerUserKeys, n, "per-user-key count")
}

func checkPerUserKeyCountLocal(tc *libkb.TestContext, n int) {
	t := tc.T
	pukring, err := tc.G.GetPerUserKeyring()
	require.NoError(t, err)
	hak := pukring.HasAnyKeys()
	if n == 0 {
		require.False(t, hak, "unexpectedly has per-user-key")
	} else {
		if !hak {
			require.FailNow(t, "has no per-user-keys")
		}
		require.Equal(t, keybase1.PerUserKeyGeneration(n), pukring.CurrentGeneration(), "wrong latest per-user-key generation")
	}
}

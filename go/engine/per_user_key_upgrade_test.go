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
	tc.Tp.SupportPerUserKey = false

	fu := CreateAndSignupFakeUserPaper(tc, "pukup")

	checkPerUserKeyCount := func(n int) {
		me, err := libkb.LoadMe(libkb.NewLoadUserForceArg(tc.G))
		require.NoError(t, err)
		require.Len(t, me.ExportToUserPlusKeys(keybase1.Time(0)).PerUserKeys, n, "per-user-key count")
	}

	checkPerUserKeyCountLocal := func(n int) {
		pukring, err := tc.G.GetPerUserKeyring()
		require.NoError(t, err)
		if n == 0 {
			require.False(t, pukring.HasAnyKeys(), "unexpectedly has per-user-key")
		} else {
			require.Equal(t, keybase1.PerUserKeyGeneration(n), pukring.CurrentGeneration(), "wrong latest per-user-key generation")
		}
	}

	checkPerUserKeyCount(0)

	tc.Tp.UpgradePerUserKey = true

	t.Logf("upgrade")
	upgrade := func() *PerUserKeyUpgrade {
		arg := &PerUserKeyUpgradeArgs{}
		eng := NewPerUserKeyUpgrade(tc.G, arg)
		ctx := &Context{
			LogUI:    tc.G.UI.GetLogUI(),
			SecretUI: fu.NewSecretUI(),
		}
		err := RunEngine(eng, ctx)
		require.NoError(t, err)
		return eng
	}
	require.True(t, upgrade().DidNewKey, "created key")

	checkPerUserKeyCountLocal(1)
	checkPerUserKeyCount(1)

	t.Logf("revoke paper key")
	revokeAnyPaperKey(tc, fu)

	t.Logf("should be on gen 2")
	checkPerUserKeyCountLocal(2)
	checkPerUserKeyCount(2)

	t.Logf("run the upgrade engine again. Expect an error because the user is already up.")
	require.False(t, upgrade().DidNewKey, "did not create key")
}

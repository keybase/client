// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestProveCheck(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		tc := SetupEngineTest(t, "proveCheck")
		defer tc.Cleanup()

		fu := CreateAndSignupFakeUser(tc, "prove")

		proveCheck := func(sigID keybase1.SigID, noText bool) {
			checkEng := NewProveCheck(tc.G, sigID)
			m := libkb.NewMetaContextTODO(tc.G)
			err := RunEngine2(m, checkEng)
			require.NoError(t, err)

			found, status, state, text := checkEng.Results()
			require.True(t, found)
			require.Equal(t, keybase1.ProofStatus_OK, status)
			require.Equal(t, keybase1.ProofState_OK, state)
			if noText {
				require.Zero(t, len(text))
			} else {
				require.NotZero(t, len(text))
			}
		}

		proveUI, sigID, err := proveRooter(tc.G, fu, sigVersion)
		require.NoError(t, err)
		require.False(t, proveUI.overwrite)
		require.False(t, proveUI.warning)
		require.False(t, proveUI.recheck)
		require.True(t, proveUI.checked)
		proveCheck(sigID, false /* noText */)

		sigID = proveGubbleSocial(tc, fu, sigVersion)
		proveCheck(sigID, true /* noText */)
	})
}

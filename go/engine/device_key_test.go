// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestDeviceKey(t *testing.T) {
	tc := SetupEngineTest(t, "dkal")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "dkal")

	check := func() {
		u, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
		require.NoError(t, err)
		require.NotNil(t, u,
			"Can't load current user")

		if subkey, err := u.GetDeviceSubkey(); err != nil {
			require.NoError(t, err)
		} else if subkey == nil {
			require.NotNil(t, subkey,
				"Failed to load device subkey right after signup")
		}
	}
	check()

	Logout(tc)
	fu.LoginOrBust(tc)
	check()
}

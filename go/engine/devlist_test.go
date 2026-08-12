// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDeviceList(t *testing.T) {
	tc := SetupEngineTest(t, "devicelist")
	defer tc.Cleanup()

	CreateAndSignupFakeUserPaper(tc, "login")

	eng := NewDevList(tc.G)
	m := NewMetaContextForTestWithLogUI(tc)
	if err := RunEngine2(m, eng); err != nil {
		require.NoError(t, err)
	}
	if len(eng.List()) != 2 {
		for i, d := range eng.List() {
			t.Logf("%d: %+v", i, d)
		}
		require.Fail(t, "devices: %d, expected 2", len(eng.List()))
	}
	// Check that the device times are all actually set.
	for _, d := range eng.List() {
		require.NotZero(t, d.CTime, "CTime not set")
		require.NotZero(t, d.MTime, "MTime not set")
		require.NotZero(t, d.LastUsedTime, "LastUsedTime not set")
	}
}

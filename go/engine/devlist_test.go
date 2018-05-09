// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import "testing"

func TestDeviceList(t *testing.T) {
	tc := SetupEngineTest(t, "devicelist")
	defer tc.Cleanup()

	CreateAndSignupFakeUserPaper(tc, "login")

	eng := NewDevList(tc.G)
	m := NewMetaContextForTestWithLogUI(tc)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}
	if len(eng.List()) != 2 {
		for i, d := range eng.List() {
			t.Logf("%d: %+v", i, d)
		}
		t.Errorf("devices: %d, expected 2", len(eng.List()))
	}
	// Check that the device times are all actually set.
	for _, d := range eng.List() {
		if d.CTime == 0 {
			t.Fatal("CTime not set")
		}
		if d.MTime == 0 {
			t.Fatal("MTime not set")
		}
		if d.LastUsedTime == 0 {
			t.Fatal("LastUsedTime not set")
		}
	}
}

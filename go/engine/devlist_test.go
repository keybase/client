// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package engine

import "testing"

func TestDeviceList(t *testing.T) {
	tc := SetupEngineTest(t, "devicelist")
	defer tc.Cleanup()

	CreateAndSignupFakeUser(tc, "login")

	ctx := &Context{LogUI: tc.G.UI.GetLogUI()}
	eng := NewDevList(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	if len(eng.List()) != 2 {
		for i, d := range eng.List() {
			t.Logf("%d: %+v", i, d)
		}
		t.Errorf("devices: %d, expected 2", len(eng.List()))
	}
}

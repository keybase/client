// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestLoadUserPlusKeysHasKeys(t *testing.T) {
	tc := SetupEngineTest(t, "user")
	defer tc.Cleanup()

	CreateAndSignupFakeUser(tc, "login")
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}
	up, err := libkb.LoadUserPlusKeys(tc.G, me.GetUID(), true)
	if err != nil {
		t.Fatal(err)
	}
	if len(up.DeviceKeys) != 4 {
		t.Errorf("num device keys: %d, expected 4", len(up.DeviceKeys))
	}
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import "testing"

func TestLoginUsername(t *testing.T) {
	tc := SetupEngineTest(t, "lu")
	defer tc.Cleanup()

	ctx := &Context{}
	eng := NewLoginUsername(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}

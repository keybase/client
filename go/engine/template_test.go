// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build ignore
//
// This is a test template for the Template engine.

package engine

import "testing"

func TestTemplate(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()

	ctx := &Context{}
	eng := NewTemplate(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}

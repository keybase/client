// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"fmt"
	"testing"
)

func TestNamedRegsStore(t *testing.T) {
	tests := []struct {
		shouldwork               bool
		op, arg1, arg2, expected string
	}{
		// banning a register works
		{true, "Ban", "banned", "", ""},
		{false, "Ban", "banned", "", ""},
		{false, "Set", "banned", "foo", ""},
		{false, "Get", "banned", "", ""},

		// set and get works
		// cannot ban a set register
		{true, "Set", "x", "foo", ""},
		{true, "Get", "x", "", "foo"},
		{false, "Ban", "x", "", ""},
		{true, "Get", "x", "", "foo"},

		// cannot set twice
		{true, "Set", "y", "bar", ""},
		{true, "Get", "y", "", "bar"},
		{false, "Set", "y", "baz", ""},
		{true, "Get", "y", "", "bar"},

		// cannot use invalid keys
		{false, "Set", "Z", "", ""},
		{false, "Get", "Z", "", ""},
		{false, "Set", "specialchar@", "oosh", ""},
		{false, "Set", "", "oosh", ""},
		{false, "Ban", "#!", "", ""},

		// can use valid keys
		{true, "Set", "tmp1_2", "fuzzle", ""},
		{true, "Get", "tmp1_2", "", "fuzzle"},

		// empty string is an ok value
		{true, "Set", "empty", "", ""},
		{true, "Get", "empty", "", ""},
	}

	regs := *newNamedRegsStore()

	for i, unit := range tests {
		var err error
		var res string
		useRes := false

		fail := func(f string, args ...interface{}) {
			prefix := fmt.Sprintf("[%v] ", i)
			t.Fatalf(prefix+f, args...)
		}

		switch unit.op {
		case "Get":
			res, err = regs.Get(unit.arg1)
			useRes = true
		case "Set":
			err = regs.Set(unit.arg1, unit.arg2)
		case "Ban":
			err = regs.Ban(unit.arg1)
		}

		if err == nil {
			if !unit.shouldwork {
				fail("should have failed")
			}
			if useRes && (res != unit.expected) {
				fail("got '%v'; expected '%v'", res, unit.expected)
			}
		} else {
			if unit.shouldwork {
				fail("should have worked; got %v", err)
			}
		}
	}
}

func TestNamedRegsStoreCopy(t *testing.T) {
	// Copying a store aliases its state.
	// This should not be depended on but it's good to know.
	regs1 := *newNamedRegsStore()
	var regs2 namedRegsStore
	regs2 = regs1

	err := regs1.Set("foo", "1")
	if err != nil {
		t.Fatal()
	}

	err = regs2.Set("foo", "1")
	if err == nil {
		t.Fatal()
	}
}

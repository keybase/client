// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"testing"
)

type cmpTest struct {
	a, b string
	eq   bool
}

var nameCmpTest = []cmpTest{
	{a: "UpperCase", b: "uppercase", eq: true},
	{a: " Space prefix", b: "Space prefix", eq: true},
	{a: "Space suffix ", b: "Space suffix", eq: true},
	{a: "Space Inside", b: "SpaceInside", eq: true},
	{a: "work iPad", b: "work ipad", eq: true},
	{a: "my_ipad", b: "MY IPAD", eq: true},
	{a: "device a", b: "device b", eq: false},
	{a: "mike's computer", b: "mikes computer", eq: true},
	{a: "my+-'_device", b: "my device", eq: true},
}

func TestNameCmp(t *testing.T) {
	for _, test := range nameCmpTest {
		eq := NameCmp(test.a, test.b)
		if eq != test.eq {
			t.Errorf("name compare %q == %q => %v, expected %v", test.a, test.b, eq, test.eq)
		}
	}
}

func TestCombineErrors(t *testing.T) {
	err := CombineErrors(fmt.Errorf("error1"), nil, fmt.Errorf("error3"))
	expected := "There were multiple errors: error1; error3"
	if err.Error() != expected {
		t.Errorf("Wrong output for combine errors: %#v != %#v", err.Error(), expected)
	}
}

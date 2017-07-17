// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "testing"

type checkerTest struct {
	input string
	valid bool
}

var deviceNameTests = []checkerTest{
	{input: "home computer", valid: true},
	{input: " home computer", valid: false},
	{input: " home computer ", valid: false},
	{input: "home computer ", valid: false},
	{input: "home  computer", valid: false},
	{input: "home - computer", valid: true},
	{input: "Mike's computer", valid: true},
	{input: "tab\tcomputer", valid: false},
	{input: "foo -- computer", valid: false},
	{input: "foo - _ - computer", valid: false},
	{input: "home computer-", valid: false},
	{input: "home computer+", valid: false},
	{input: "home computer'", valid: false},
	{input: "home computer_", valid: false},
}

func TestCheckDeviceName(t *testing.T) {
	for _, test := range deviceNameTests {
		res := CheckDeviceName.F(test.input)
		if res != test.valid {
			t.Errorf("input: %q, got %v, expected %v", test.input, res, test.valid)
		}
	}
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "testing"

type checkerTest struct {
	input string
	valid bool
}

var usernameTests = []checkerTest{
	{input: "a", valid: false},
	{input: "az", valid: true},
	{input: "0123456789abcdef", valid: true},
	{input: "0123456789abcdefg", valid: false},
	{input: "_foo", valid: false},
	{input: "foo_bar_baz", valid: true},
	{input: "foo__bar", valid: false},
	{input: "Upper_Case", valid: true},
}

func TestCheckUsername(t *testing.T) {
	for _, test := range usernameTests {
		res := CheckUsername.F(test.input)
		if res != test.valid {
			t.Errorf("input: %q, got %v, expected %v", test.input, res, test.valid)
		}
	}
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
	{input: "not😂ascii", valid: false},
}

func TestCheckDeviceName(t *testing.T) {
	for _, test := range deviceNameTests {
		res := CheckDeviceName.F(test.input)
		if res != test.valid {
			t.Errorf("input: %q, got %v, expected %v", test.input, res, test.valid)
		}
	}
}

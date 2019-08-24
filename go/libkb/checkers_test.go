// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

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
		require.Equal(t, res, test.valid)
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
	{input: "home computer+", valid: true},
	{input: "home computer'", valid: false},
	{input: "home computer_", valid: false},
	{input: "not😂ascii", valid: false},
	{input: "John’s iPhone", valid: true},
	{input: "absolute@unit", valid: false},
	{input: "absolute(unit", valid: false},
}

func TestCheckDeviceName(t *testing.T) {
	for _, test := range deviceNameTests {
		res := CheckDeviceName.F(test.input)
		require.Equal(t, res, test.valid)
	}
}

type normalizeTest struct {
	name1 string
	name2 string
}

var deviceNormalizeTests = []normalizeTest{
	{name1: "home computer", name2: "homecomputer"},
	{name1: "home - computer", name2: "homecomputer"},
	{name1: "Mike's computer", name2: "mikescomputer"},
	{name1: "John’s iPhone", name2: "johnsiphone"},
}

func TestNormalizeDeviceName(t *testing.T) {
	for _, test := range deviceNormalizeTests {
		require.Equal(t, test.name2, CheckDeviceName.Normalize(test.name1))
	}
}

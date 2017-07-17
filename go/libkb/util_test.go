// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
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

func TestWhitespaceNormalize(t *testing.T) {

	data := []struct {
		in, out string
	}{
		{" ab   cd    ef   gh ", "ab cd ef gh"},
		{"a\nb  c\nd", "a b c d"},
		{" a ", "a"},
		{"\na\nb ", "a b"},
		{
			" Verifying myself: I am pomf on Keybase.io. 8a6cewzit2o7zuLKGbDqQADhzfOlGerGuBpq\n/ https://keybase.io/pomf/sigs/8a6cewzit2o7zuLKGbDqQADhzfOlGerGuBpq ",
			"Verifying myself: I am pomf on Keybase.io. 8a6cewzit2o7zuLKGbDqQADhzfOlGerGuBpq / https://keybase.io/pomf/sigs/8a6cewzit2o7zuLKGbDqQADhzfOlGerGuBpq",
		},
	}

	for i, p := range data {
		out := WhitespaceNormalize(p.in)
		if out != p.out {
			t.Errorf("Failed on test %d: %s != %s", i, out, p.out)
		}
	}

}

func TestMakeByte24(t *testing.T) {
	var x1 [24]byte
	var x2 [31]byte
	var x3 [33]byte

	x1[3] = 5

	y := MakeByte24(x1[:])
	require.Equal(t, x1, y)

	require.Panics(t, func() {
		MakeByte24(x2[:])
	})

	require.Panics(t, func() {
		MakeByte24(x3[:])
	})
}

func TestMakeByte32(t *testing.T) {
	var x1 [32]byte
	var x2 [31]byte
	var x3 [33]byte

	x1[3] = 5

	y := MakeByte32(x1[:])
	require.Equal(t, x1, y)

	require.Panics(t, func() {
		MakeByte32(x2[:])
	})

	require.Panics(t, func() {
		MakeByte32(x3[:])
	})
}

// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStellarSimplifyAmount(t *testing.T) {
	units := []struct {
		a, b string
	}{
		{"", ""},
		{"1", "1"},
		{"100", "100"},
		{"100.00", "100"},
		{"100.0000001", "100.0000001"},
		{"100.000000100", "100.0000001"},
		{"0100.00", "0100"},
		{".1", ".1"},
		{".01", ".01"},
		{".010", ".01"},
		{"1.0010000", "1.001"},
		{"1.0000000", "1"},
		{"aaa", "aaa"},
	}
	for i, u := range units {
		require.Equal(t, u.b, StellarSimplifyAmount(u.a), "units[%v]", i)
	}
}

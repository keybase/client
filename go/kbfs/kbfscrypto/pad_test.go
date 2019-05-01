// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscrypto

import (
	"bytes"
	"testing"
	"testing/quick"

	"github.com/stretchr/testify/require"
)

// Test padding of blocks results in a larger block, with length
// equal to power of 2 + 4.
func TestBlockPadding(t *testing.T) {
	f := func(b []byte) bool {
		padded, err := PadBlock(b)
		if err != nil {
			t.Logf("padBlock err: %s", err)
			return false
		}
		n := len(padded)
		if n <= len(b) {
			t.Logf("padBlock padded block len %d <= input block len %d", n, len(b))
			return false
		}
		// len of slice without uint32 prefix:
		h := n - 4
		if h&(h-1) != 0 {
			t.Logf("padBlock padded block len %d not a power of 2", h)
			return false
		}
		return true
	}

	err := quick.Check(f, nil)
	require.NoError(t, err)
}

// Tests padding -> depadding results in same block data.
func TestBlockDepadding(t *testing.T) {
	f := func(b []byte) bool {
		padded, err := PadBlock(b)
		if err != nil {
			t.Logf("padBlock err: %s", err)
			return false
		}
		depadded, err := DepadBlock(padded)
		if err != nil {
			t.Logf("depadBlock err: %s", err)
			return false
		}
		if !bytes.Equal(b, depadded) {
			return false
		}
		return true
	}

	err := quick.Check(f, nil)
	require.NoError(t, err)
}

// Test padding of blocks results in blocks at least 2^8.
func TestBlockPadMinimum(t *testing.T) {
	for i := 0; i < 256; i++ {
		b := make([]byte, i)
		err := RandRead(b)
		require.NoError(t, err)
		padded, err := PadBlock(b)
		require.NoError(t, err)
		require.Equal(t, 260, len(padded))
	}
}

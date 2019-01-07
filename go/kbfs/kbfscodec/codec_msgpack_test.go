// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscodec

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestCodecEncodeMap tests that codec.Encode() isn't affected by map
// iteration order.
func TestCodecEncodeMap(t *testing.T) {
	m1 := make(map[int]int)
	m2 := make(map[int]int)
	for i := 0; i < 10; i++ {
		m1[i] = 1
		m2[9-i] = 1
	}

	codec := NewMsgpack()

	b1, err := codec.Encode(m1)
	require.NoError(t, err)

	b2, err := codec.Encode(m2)
	require.NoError(t, err)

	require.Equal(t, b1, b2)
}

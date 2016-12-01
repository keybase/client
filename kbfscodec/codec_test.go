// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscodec

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCodecEqualNil(t *testing.T) {
	codec := NewMsgpack()

	nils := []interface{}{nil, (*int)(nil), (*float64)(nil)}
	nonNils := []interface{}{1, "two"}

	for _, o1 := range nils {
		for _, o2 := range nils {
			eq, err := Equal(codec, o1, o2)
			require.NoError(t, err)
			require.True(t, eq)
		}
	}

	for _, o1 := range nils {
		for _, o2 := range nonNils {
			eq, err := Equal(codec, o1, o2)
			require.NoError(t, err)
			require.False(t, eq)

			eq, err = Equal(codec, o2, o1)
			require.NoError(t, err)
			require.False(t, eq)
		}
	}
}

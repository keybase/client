// Copyright 2021 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNameEncoding(t *testing.T) {
	var fixture = [][2]string{
		{`foo`, `foo`},
		{`foo\bar`, `foo%5cbar`},
		{`foo%bar`, `foo%25bar`},
		{`foo%\bar`, `foo%25%5cbar`},
	}

	for _, entry := range fixture {
		require.Equal(t, entry[1], encodeKbfsNameForWindows(entry[0]))

		kbfsName, err := decodeWindowsNameForKbfs(entry[1])
		require.NoError(t, err)
		require.Equal(t, entry[0], kbfsName)

		_, err = decodeWindowsNameForKbfs(`a\b`)
		require.Error(t, err)
	}
}

// Copyright 2021 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNameEncoding(t *testing.T) {
	var fixture = [][2]string{
		{`foo`, `foo`},
		{`foo\bar`, `foo‰5cbar`},
		{`foo‰bar`, `foo‰2030bar`},
		{`foo‰\bar`, `foo‰2030‰5cbar`},
		{`foo%bar`, `foo%bar`},
		{"<", "‰3c"},
		{">", "‰3e"},
		{":", "‰3a"},
		{"\"", "‰22"},
		{"/", "‰2f"},
		{"\\", "‰5c"},
		{"|", "‰7c"},
		{"?", "‰3f"},
		{"*", "‰2a"},
	}

	for _, entry := range fixture {
		require.Equal(t, entry[1], EncodeKbfsNameForWindows(entry[0]))

		kbfsName, err := DecodeWindowsNameForKbfs(entry[1])
		require.NoError(t, err)
		require.Equal(t, entry[0], kbfsName)

	}

	_, err := DecodeWindowsNameForKbfs(`a\b`)
	require.Error(t, err)
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package version

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParse(t *testing.T) {
	input := "Keybase-1.0.14-20160312013917+cd6f696.zip"
	version, versionShort, versionTime, commit, err := Parse(input)
	require.NoError(t, err)
	require.Equal(t, "1.0.14-20160312013917+cd6f696", version, "Failed to parse version properly: %s", version)
	require.Equal(t, "1.0.14", versionShort, "Failed to parse version properly: %s", versionShort)
	timeCheck, _ := time.Parse("20060102150405", "20160312013917")
	require.Equal(t, timeCheck, versionTime, "Failed to parse time properly: %s", timeCheck)
	require.Equal(t, "cd6f696", commit, "Failed to parse commit properly: %s", commit)
}

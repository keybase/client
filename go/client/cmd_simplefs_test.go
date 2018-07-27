// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestMakeSimpleFSPath(t *testing.T) {
	check := func(path string, rev int64, timeString, relTimeString string,
		expectedPT keybase1.PathType) {
		p, err := makeSimpleFSPathWithArchiveParams(
			path, rev, timeString, relTimeString)
		require.NoError(t, err)
		pt, err := p.PathType()
		require.NoError(t, err)
		require.Equal(t, expectedPT, pt)
		if rev != 0 {
			archivedPath := p.KbfsArchived()
			paramRev := archivedPath.ArchivedParam.Revision()
			require.Equal(t, keybase1.KBFSRevision(rev), paramRev)
		} else if timeString != "" {
			archivedPath := p.KbfsArchived()
			paramTimeString := archivedPath.ArchivedParam.TimeString()
			require.Equal(t, timeString, paramTimeString)
		} else if relTimeString != "" {
			archivedPath := p.KbfsArchived()
			paramTimeString := archivedPath.ArchivedParam.RelTimeString()
			require.Equal(t, relTimeString, paramTimeString)
		}
	}

	// Local path.
	check("/tmp/", 0, "", "", keybase1.PathType_LOCAL)

	// KBFS paths.
	check("/keybase/private/jdoe", 0, "", "", keybase1.PathType_KBFS)

	// KBFS archived path.
	check("/keybase/private/jdoe", 10, "", "", keybase1.PathType_KBFS_ARCHIVED)

	// KBFS time string.
	check(
		"/keybase/private/jdoe", 0, "2018-01-01", "",
		keybase1.PathType_KBFS_ARCHIVED)

	// KBFS relative time string.
	check(
		"/keybase/private/jdoe", 0, "", "1h30s",
		keybase1.PathType_KBFS_ARCHIVED)
}

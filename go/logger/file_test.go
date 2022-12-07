// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"fmt"

	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestScanOldLogFiles(t *testing.T) {
	dir, err := os.MkdirTemp("", "log-rotation-test")
	require.NoError(t, err)
	defer os.RemoveAll(dir)
	fmt.Println(dir)
	p := filepath.Join(dir, "keybase.kbfs.log")

	// hack for test only
	originalLocal := time.Local
	time.Local = time.FixedZone("Minus6", -6*3600)
	defer func() { time.Local = originalLocal }()

	logFilenames := []string{
		filepath.Join(dir, "keybase.kbfs.log-20170213T162521-20170213T163321"),
		filepath.Join(dir, "keybase.kbfs.log-20170213T163321-20170213T164105"),
		filepath.Join(dir, "keybase.kbfs.log-20170213T163321-0700-20170214T142252-0600"),
		filepath.Join(dir, "keybase.kbfs.log-20170214T142252-0600-20170214T142713-0600"),
		filepath.Join(dir, "keybase.kbfs.log-20170214T142713-0600-20170214T143359-0600"),
		filepath.Join(dir, "keybase.kbfs.log-20170214T143359-0600-20170214T144159-0600"),
		filepath.Join(dir, "keybase.kbfs.log-20170217T000000+0600-20170217T000000+0600"),
	}
	nonLogFilenames := []string{
		filepath.Join(dir, "O_O"),
		filepath.Join(dir, "keybase.kbfs-20170213T162521-20170213T163321"),
		filepath.Join(dir, "keybase.kbfs-20170214T142129-0600-20170214T142252-0600"),
	}
	for _, fn := range append(logFilenames, nonLogFilenames...) {
		require.NoError(t, os.WriteFile(fn, []byte("hello"), 0644))
	}

	fNames, err := scanOldLogFiles(p)
	require.NoError(t, err)
	require.Len(t, fNames, len(logFilenames))
	for i, n := range fNames {
		require.Equal(t, n, logFilenames[i])
	}
}

// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"os"
	"strings"
	"testing"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/stretchr/testify/require"
)

func TestDeobfuscate(t *testing.T) {
	os.Setenv("KEYBASE_TEST_OBFUSCATE_LOGS", "true")
	ctx, _, fs := makeFS(t, "")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, fs.config)

	t.Log("Check basic obfuscate->deobfuscate path")
	p := "a/b"
	err := fs.MkdirAll(p, os.FileMode(0600))
	require.NoError(t, err)
	obsPath := fs.PathForLogging(p)
	require.NotEqual(t, p, obsPath)
	res, err := Deobfuscate(ctx, fs, obsPath)
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Equal(t, p, res[0])

	t.Log("Check conflict suffix with no extension")
	res, err = Deobfuscate(ctx, fs, obsPath+"-2")
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Equal(t, p, res[0])

	t.Log("Check conflict suffix with extension")
	file := "a/foo.txt"
	f, err := fs.Create(file)
	require.NoError(t, err)
	f.Close()
	obsPathFile := fs.PathForLogging(file)
	require.NotEqual(t, p, obsPathFile)
	res, err = Deobfuscate(ctx, fs, obsPathFile)
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Equal(t, file, res[0])
	obsPathFileSuffix := strings.Replace(obsPathFile, ".txt", "-2.txt", 1)
	res, err = Deobfuscate(ctx, fs, obsPathFileSuffix)
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Equal(t, file, res[0])

	t.Log("Check symlink")
	p2 := "a/c"
	err = fs.Symlink("b", p2)
	require.NoError(t, err)
	res, err = Deobfuscate(ctx, fs, obsPath)
	require.NoError(t, err)
	require.Len(t, res, 2)
	require.Contains(t, res, p)
	require.Contains(t, res, p2+" (b)")
}

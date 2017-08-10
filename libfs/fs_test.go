// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"bytes"
	"context"
	"os"
	"path"
	"testing"
	"time"

	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

func makeFS(t *testing.T, subdir string) (
	context.Context, *libkbfs.TlfHandle, *FS) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	config := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)
	fs, err := NewFS(ctx, config, h, subdir)
	require.NoError(t, err)
	return ctx, h, fs
}

func testCreateFile(
	t *testing.T, ctx context.Context, fs *FS, file string,
	parent libkbfs.Node) {
	f, err := fs.Create(file)
	require.NoError(t, err)
	require.Equal(t, file, f.Name())

	children, err := fs.config.KBFSOps().GetDirChildren(ctx, parent)
	require.NoError(t, err)
	require.Contains(t, children, path.Base(file))

	// Write to the file.
	data := []byte{1}
	n, err := f.Write(data)
	require.NoError(t, err)
	require.Equal(t, 1, n)

	err = f.Close()
	require.NoError(t, err)

	// Re-open and read the file.
	f, err = fs.Open(file)
	require.NoError(t, err)
	gotData := make([]byte, len(data))
	n, err = f.Read(gotData)
	require.NoError(t, err)
	require.Equal(t, len(data), n)
	require.True(t, bytes.Equal(data, gotData))

	// Shouldn't be able to write to a read-only file.
	_, err = f.Write(gotData)
	require.NotNil(t, err)

	err = f.Close()
	require.NoError(t, err)

	err = fs.SyncAll()
	require.NoError(t, err)
}

func TestCreateFileInRoot(t *testing.T) {
	ctx, h, fs := makeFS(t, "")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, fs.config)

	rootNode, _, err := fs.config.KBFSOps().GetRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)

	testCreateFile(t, ctx, fs, "foo", rootNode)
}

func TestCreateFileInSubdir(t *testing.T) {
	ctx, h, fs := makeFS(t, "")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, fs.config)

	rootNode, _, err := fs.config.KBFSOps().GetRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	aNode, _, err := fs.config.KBFSOps().CreateDir(ctx, rootNode, "a")
	require.NoError(t, err)
	bNode, _, err := fs.config.KBFSOps().CreateDir(ctx, aNode, "b")
	require.NoError(t, err)

	testCreateFile(t, ctx, fs, "a/b/foo", bNode)
}

func TestAppendFile(t *testing.T) {
	ctx, h, fs := makeFS(t, "")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, fs.config)

	rootNode, _, err := fs.config.KBFSOps().GetRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)

	testCreateFile(t, ctx, fs, "foo", rootNode)
	f, err := fs.OpenFile("foo", os.O_APPEND, 0600)
	require.NoError(t, err)

	// Append one byte to the file.
	data := []byte{2}
	n, err := f.Write(data)
	require.NoError(t, err)
	require.Equal(t, 1, n)

	err = f.Close()
	require.NoError(t, err)

	// Re-open and read the file.
	f, err = fs.Open("foo")
	require.NoError(t, err)
	gotData := make([]byte, 2)
	n, err = f.Read(gotData)
	require.NoError(t, err)
	require.Equal(t, len(gotData), n)

	err = f.Close()
	require.NoError(t, err)

	err = fs.SyncAll()
	require.NoError(t, err)
}

func TestRecreateAndExcl(t *testing.T) {
	ctx, h, fs := makeFS(t, "")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, fs.config)

	rootNode, _, err := fs.config.KBFSOps().GetRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)

	testCreateFile(t, ctx, fs, "foo", rootNode)

	// Re-create the same file.
	f, err := fs.Create("foo")
	require.NoError(t, err)
	err = f.Close()
	require.NoError(t, err)

	// Try to create it with EXCL, and fail.
	f, err = fs.OpenFile("foo", os.O_CREATE|os.O_EXCL, 0600)
	require.NotNil(t, err)

	// Creating a different file exclusively should work though.
	f, err = fs.OpenFile("foo2", os.O_CREATE|os.O_EXCL, 0600)
	require.NoError(t, err)
	err = f.Close()
	require.NoError(t, err)
	err = fs.SyncAll()
	require.NoError(t, err)
}

func TestStat(t *testing.T) {
	ctx, h, fs := makeFS(t, "")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, fs.config)

	clock := &libkbfs.TestClock{}
	clock.Set(time.Now())
	fs.config.SetClock(clock)

	rootNode, _, err := fs.config.KBFSOps().GetRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	aNode, _, err := fs.config.KBFSOps().CreateDir(ctx, rootNode, "a")
	require.NoError(t, err)
	testCreateFile(t, ctx, fs, "a/foo", aNode)

	// Check the dir
	fi, err := fs.Stat("a")
	require.NoError(t, err)
	checkDir := func(fi os.FileInfo, isWriter bool) {
		require.Equal(t, "a", fi.Name())
		// Not sure exactly what the dir size should be.
		require.True(t, fi.Size() > 0)
		expectedMode := os.FileMode(0500) | os.ModeDir
		if isWriter {
			expectedMode |= 0200
		}
		require.Equal(t, expectedMode, fi.Mode())
		require.Equal(t, clock.Now(), fi.ModTime())
		require.True(t, fi.IsDir())
	}
	checkDir(fi, true)

	// Check the file
	fi, err = fs.Stat("a/foo")
	require.NoError(t, err)
	checkFile := func(fi os.FileInfo, isWriter bool) {
		require.Equal(t, "foo", fi.Name())
		require.Equal(t, int64(1), fi.Size())
		expectedMode := os.FileMode(0400)
		if isWriter {
			expectedMode |= 0200
		}
		require.Equal(t, expectedMode, fi.Mode())
		require.Equal(t, clock.Now(), fi.ModTime())
		require.False(t, fi.IsDir())
	}
	checkFile(fi, true)

	// Try a read-only file.
	config2 := libkbfs.ConfigAsUser(fs.config.(*libkbfs.ConfigLocal), "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	config2.SetClock(clock)

	h2, err := libkbfs.ParseTlfHandle(
		ctx, config2.KBPKI(), "user2#user1", tlf.Private)
	require.NoError(t, err)
	fs2U2, err := NewFS(ctx, config2, h2, "")
	require.NoError(t, err)
	rootNode2, _, err := fs2U2.config.KBFSOps().GetRootNode(
		ctx, h2, libkbfs.MasterBranch)
	require.NoError(t, err)
	aNode2, _, err := fs2U2.config.KBFSOps().CreateDir(ctx, rootNode2, "a")
	require.NoError(t, err)
	testCreateFile(t, ctx, fs2U2, "a/foo", aNode2)

	// Read as the reader.
	fs2U1, err := NewFS(ctx, fs.config, h2, "")
	require.NoError(t, err)

	fi, err = fs2U1.Stat("a")
	require.NoError(t, err)
	checkDir(fi, false)

	fi, err = fs2U1.Stat("a/foo")
	require.NoError(t, err)
	checkFile(fi, false)
}

func TestRename(t *testing.T) {
	ctx, h, fs := makeFS(t, "")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, fs.config)

	rootNode, _, err := fs.config.KBFSOps().GetRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	testCreateFile(t, ctx, fs, "foo", rootNode)
	err = fs.MkdirAll("a/b", os.FileMode(0600))
	require.NoError(t, err)

	f, err := fs.Open("foo")
	require.NoError(t, err)
	gotDataFoo := make([]byte, 1)
	_, err = f.Read(gotDataFoo)
	require.NoError(t, err)
	err = f.Close()
	require.NoError(t, err)

	err = fs.Rename("foo", "a/b/bar")
	require.NoError(t, err)

	f, err = fs.Open("a/b/bar")
	require.NoError(t, err)
	gotDataBar := make([]byte, 1)
	_, err = f.Read(gotDataBar)
	require.NoError(t, err)
	require.True(t, bytes.Equal(gotDataFoo, gotDataBar))
	err = f.Close()
	require.NoError(t, err)

	_, err = fs.Open("foo")
	require.NotNil(t, err)

	err = fs.SyncAll()
	require.NoError(t, err)
}

func TestRemove(t *testing.T) {
	ctx, h, fs := makeFS(t, "")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, fs.config)

	rootNode, _, err := fs.config.KBFSOps().GetRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	testCreateFile(t, ctx, fs, "foo", rootNode)
	err = fs.MkdirAll("a/b", os.FileMode(0600))
	require.NoError(t, err)

	// Remove a file.
	err = fs.Remove("foo")
	require.NoError(t, err)
	_, err = fs.Open("foo")
	require.NotNil(t, err)

	// Removing "a" should fail because it's not empty.
	err = fs.Remove("a")
	require.NotNil(t, err)

	// Remove an empty dir and verify we can't create a file there
	// anymore.
	err = fs.Remove("a/b")
	require.NoError(t, err)
	_, err = fs.Create("a/b/foo")
	require.NotNil(t, err)

	err = fs.SyncAll()
	require.NoError(t, err)
}

func TestReadDir(t *testing.T) {
	ctx, h, fs := makeFS(t, "")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, fs.config)

	rootNode, _, err := fs.config.KBFSOps().GetRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	aNode, _, err := fs.config.KBFSOps().CreateDir(ctx, rootNode, "a")
	require.NoError(t, err)
	testCreateFile(t, ctx, fs, "a/foo", aNode)
	testCreateFile(t, ctx, fs, "a/bar", aNode)
	expectedNames := map[string]bool{
		"foo": true,
		"bar": true,
	}

	fis, err := fs.ReadDir("a")
	require.NoError(t, err)
	require.Len(t, fis, len(expectedNames))
	for _, fi := range fis {
		require.True(t, expectedNames[fi.Name()])
		delete(expectedNames, fi.Name())
	}
	require.Len(t, expectedNames, 0)
}

func TestMkdirAll(t *testing.T) {
	ctx, _, fs := makeFS(t, "")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, fs.config)

	err := fs.MkdirAll("a/b", os.FileMode(0600))
	require.NoError(t, err)

	err = fs.MkdirAll("a/b/c/d", os.FileMode(0600))
	require.NoError(t, err)

	_, err = fs.Create("a/b/c/d/foo")
	require.NoError(t, err)
}

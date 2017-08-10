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

	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

func makeFS(t *testing.T, subdir string) (
	context.Context, *libkbfs.TlfHandle, *FS) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	config := libkbfs.MakeTestConfigOrBust(t, "user1")
	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)
	fs, err := NewFS(ctx, config, h, subdir)
	require.NoError(t, err)
	return ctx, h, fs
}

func testCreateFileInRoot(
	t *testing.T, ctx context.Context, fs *FS, file string,
	parent libkbfs.Node) {
	f, err := fs.Create(file)
	require.NoError(t, err)
	require.Equal(t, file, f.Name())

	children, err := fs.config.KBFSOps().GetDirChildren(ctx, parent)
	require.NoError(t, err)
	require.Len(t, children, 1)
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

	testCreateFileInRoot(t, ctx, fs, "foo", rootNode)
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

	testCreateFileInRoot(t, ctx, fs, "a/b/foo", bNode)
}

func TestAppendFile(t *testing.T) {
	ctx, h, fs := makeFS(t, "")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, fs.config)

	rootNode, _, err := fs.config.KBFSOps().GetRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)

	testCreateFileInRoot(t, ctx, fs, "foo", rootNode)
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

	testCreateFileInRoot(t, ctx, fs, "foo", rootNode)

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

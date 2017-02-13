// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package simplefs

import (
	"context"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTempRemotePath() (keybase1.Path, error) {
	// TODO: make a KBFS type path instead of a local one
	tempdir, err := ioutil.TempDir("", "simpleFstest")
	return keybase1.NewPathWithKbfs(tempdir), err
}

// TODO: This is for deleting a KBFS type path, but for now it just expects a local one
func deleteTempRemotePath(path keybase1.Path) {
	os.RemoveAll(path.Kbfs())
}

func TestList(t *testing.T) {
	ctx := context.Background()
	sfs := &SimpleFS{}

	// make a temp remote directory + files we will clean up later
	path1, err := newTempRemotePath()
	defer deleteTempRemotePath(path1)
	require.NoError(t, err)
	err = ioutil.WriteFile(filepath.Join(path1.Kbfs(), "test1.txt"), []byte("foo"), 0644)
	require.NoError(t, err)
	err = ioutil.WriteFile(filepath.Join(path1.Kbfs(), "test2.txt"), []byte("foo"), 0644)
	require.NoError(t, err)

	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	err = sfs.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID: opid,
		Path: path1,
	})
	require.NoError(t, err)

	listResult, err := sfs.SimpleFSReadList(ctx, opid)
	require.NoError(t, err)

	assert.Len(t, listResult.Entries, 2, "Expected 2 directory entries in listing")

	// Assume we've exhausted the list now, so expect error
	_, err = sfs.SimpleFSReadList(ctx, opid)
	require.Error(t, err)

	err = sfs.SimpleFSClose(ctx, opid)
	require.NoError(t, err)

	// Verify error on double close
	err = sfs.SimpleFSClose(ctx, opid)
	require.Error(t, err)
}

func TestCopyToLocal(t *testing.T) {
	ctx := context.Background()
	sfs := &SimpleFS{}

	// make a temp remote directory + file(s) we will clean up later
	path1, err := newTempRemotePath()
	defer deleteTempRemotePath(path1)
	require.NoError(t, err)
	err = ioutil.WriteFile(filepath.Join(path1.Kbfs(), "test1.txt"), []byte("foo"), 0644)
	require.NoError(t, err)

	// make a temp local dest directory + files we will clean up later
	tempdir2, err := ioutil.TempDir("", "simpleFstest")
	defer os.RemoveAll(tempdir2)
	require.NoError(t, err)
	path2 := keybase1.NewPathWithLocal(tempdir2)

	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	err = sfs.SimpleFSCopy(ctx, keybase1.SimpleFSCopyArg{
		OpID: opid,
		Src:  keybase1.NewPathWithKbfs(filepath.Join(path1.Kbfs(), "test1.txt")),
		Dest: path2, // TODO: must the dest include a name?
	})
	require.NoError(t, err)

	err = sfs.SimpleFSClose(ctx, opid)
	require.NoError(t, err)

	// Verify error on double close
	err = sfs.SimpleFSClose(ctx, opid)
	require.Error(t, err)

	exists, err := libkb.FileExists(filepath.Join(tempdir2, "test1.txt"))
	require.NoError(t, err)
	assert.True(t, exists, "File copy destination must exist")
}

func TestCopyToRemote(t *testing.T) {
	ctx := context.Background()
	sfs := &SimpleFS{}

	// make a temp remote directory + file(s) we will clean up later
	path2, err := newTempRemotePath()
	require.NoError(t, err)

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFstest")
	defer os.RemoveAll(tempdir)
	require.NoError(t, err)
	path1 := keybase1.NewPathWithLocal(tempdir)
	defer deleteTempRemotePath(path1)
	err = ioutil.WriteFile(filepath.Join(path1.Local(), "test1.txt"), []byte("foo"), 0644)
	require.NoError(t, err)

	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	err = sfs.SimpleFSCopy(ctx, keybase1.SimpleFSCopyArg{
		OpID: opid,
		Src:  keybase1.NewPathWithLocal(filepath.Join(path1.Kbfs(), "test1.txt")),
		Dest: path2, // TODO: must the dest include a name?
	})
	require.NoError(t, err)

	err = sfs.SimpleFSClose(ctx, opid)
	require.NoError(t, err)

	// Verify error on double close
	err = sfs.SimpleFSClose(ctx, opid)
	require.Error(t, err)

	exists, err := libkb.FileExists(filepath.Join(path1.Local(), "test1.txt"))
	require.NoError(t, err)
	assert.True(t, exists, "File copy destination must exist")
}

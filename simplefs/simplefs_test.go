// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package simplefs

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newSimpleFS(config libkbfs.Config) *SimpleFS {
	return &SimpleFS{
		config:  config,
		handles: map[keybase1.OpID]*handle{},
	}
}

func closeSimpleFS(ctx context.Context, t *testing.T, fs *SimpleFS) {
	err := config.Shutdown(ctx)
	require.NoError(err)
	libkbfs.CleanupCancellationDelayer(ctx)
}

func newTempRemotePath() (keybase1.Path, error) {
	var bs = make([]byte, 8)
	err := kbfscrypto.RandRead(bs)
	if err != nil {
		return keybase1.Path{}, err
	}

	raw := fmt.Sprintf(`/private/jdoe/%X`, bs)
	return keybase1.NewPathWithKbfs(raw), nil
}

// TODO: This is for deleting a KBFS type path, but for now it just expects a local one
func deleteTempRemotePath(path keybase1.Path) {
	os.RemoveAll(path.Kbfs())
}

func TestList(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	sfs := newSimpleFS(libkbfs.MakeTestConfigOrBust(t, "jdoe"))
	defer closeSimpleFS(ctx, t, sfs)

	// make a temp remote directory + files we will clean up later
	path1 := keybase1.NewPathWithKbfs(`/private/jdoe`)
	writeRemoteFile(ctx, t, sfs, `/private/jdoe/test1.txt`, []byte(`foo`))
	writeRemoteFile(ctx, t, sfs, `/private/jdoe/test2.txt`, []byte(`foo`))
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

func writeRemoteFile(ctx context.Context, t *testing.T, sfs *SimpleFS, path string, data []byte) {
	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	err = sfs.SimpleFSOpen(ctx, keybase1.SimpleFSOpenArg{
		OpID:  opid,
		Dest:  keybase1.NewPathWithKbfs(path),
		Flags: keybase1.OpenFlags_REPLACE | keybase1.OpenFlags_WRITE,
	})
	defer sfs.SimpleFSClose(ctx, opid)
	require.NoError(t, err)

	err = sfs.SimpleFSWrite(ctx, keybase1.SimpleFSWriteArg{
		OpID:    opid,
		Offset:  0,
		Content: data,
	})
	require.NoError(t, err)
}

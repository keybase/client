// Copyright 2016-2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package simplefs

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	billy "gopkg.in/src-d/go-billy.v4"
)

func syncFS(ctx context.Context, t *testing.T, fs *SimpleFS, tlf string) {
	ctx, err := fs.startOpWrapContext(ctx)
	require.NoError(t, err)
	remoteFS, _, err := fs.getFS(ctx, keybase1.NewPathWithKbfs(tlf))
	require.NoError(t, err)
	if fs, ok := remoteFS.(*libfs.FS); ok {
		err = fs.SyncAll()
	} else if fs, ok := remoteFS.(*fsBlocker); ok {
		err = fs.SyncAll()
	}
	require.NoError(t, err)
}

func closeSimpleFS(ctx context.Context, t *testing.T, fs *SimpleFS) {
	// Sync in-memory data to disk before shutting down and flushing
	// the journal.
	syncFS(ctx, t, fs, "/private/jdoe")
	err := fs.config.Shutdown(ctx)
	require.NoError(t, err)
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

func deleteTempLocalPath(path keybase1.Path) {
	os.RemoveAll(path.Local())
}

// "pending" tells whether we expect the operation to still be
// there, because there is no "none" in AsyncOps
func checkPendingOp(ctx context.Context,
	t *testing.T,
	sfs *SimpleFS,
	opid keybase1.OpID,
	expectedOp keybase1.AsyncOps,
	src keybase1.Path,
	dest keybase1.Path,
	pending bool) {

	// TODO: what do we expect the progress to be?
	_, err := sfs.SimpleFSCheck(ctx, opid)
	if pending {
		require.NoError(t, err)
	} else {
		require.Error(t, err)
	}

	ops, err := sfs.SimpleFSGetOps(ctx)

	if !pending {
		require.Len(t, ops, 0, "Expected zero pending operations")
		return
	}

	require.True(t, len(ops) > 0, "Expected at least one pending operation")

	o := ops[0]
	op, err := o.AsyncOp()
	require.NoError(t, err)
	require.Equal(t, expectedOp, op, "Expected at least one pending operation")

	// TODO: verify read/write arguments
	switch op {
	case keybase1.AsyncOps_LIST:
		list := o.List()
		require.Equal(t, list.Path, src, "Expected matching path in operation")
	case keybase1.AsyncOps_LIST_RECURSIVE:
		list := o.ListRecursive()
		require.Equal(t, list.Path, src, "Expected matching path in operation")
	case keybase1.AsyncOps_LIST_RECURSIVE_TO_DEPTH:
		list := o.ListRecursiveToDepth()
		require.Equal(t, list.Path, src, "Expected matching path in operation")
	// TODO: read is not async
	case keybase1.AsyncOps_READ:
		read := o.Read()
		require.Equal(t, read.Path, src, "Expected matching path in operation")
	// TODO: write is not asynce
	case keybase1.AsyncOps_WRITE:
		write := o.Write()
		require.Equal(t, write.Path, src, "Expected matching path in operation")
	case keybase1.AsyncOps_COPY:
		copy := o.Copy()
		require.Equal(t, copy.Src, src, "Expected matching path in operation")
		require.Equal(t, copy.Dest, dest, "Expected matching path in operation")
	case keybase1.AsyncOps_MOVE:
		move := o.Move()
		require.Equal(t, move.Src, src, "Expected matching path in operation")
		require.Equal(t, move.Dest, dest, "Expected matching path in operation")
	case keybase1.AsyncOps_REMOVE:
		remove := o.Remove()
		require.Equal(t, remove.Path, src, "Expected matching path in operation")
	}
}

func TestList(t *testing.T) {
	ctx := context.Background()
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	clock := &libkbfs.TestClock{}
	clock.Set(time.Now())
	config.SetClock(clock)
	sfs := newSimpleFS(env.EmptyAppStateUpdater{}, config)
	defer closeSimpleFS(ctx, t, sfs)

	pathRoot := keybase1.NewPathWithKbfs(`/`)
	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)
	err = sfs.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID: opid,
		Path: pathRoot,
	})
	require.NoError(t, err)
	checkPendingOp(ctx, t, sfs, opid, keybase1.AsyncOps_LIST, pathRoot, keybase1.Path{}, true)
	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)
	listResult, err := sfs.SimpleFSReadList(ctx, opid)
	require.NoError(t, err)
	require.Len(t, listResult.Entries, 3, "Expected 3 directory entries in listing")
	sort.Slice(listResult.Entries, func(i, j int) bool {
		return strings.Compare(listResult.Entries[i].Name,
			listResult.Entries[j].Name) < 0
	})
	require.Equal(t, listResult.Entries[0].Name, "private")
	require.Equal(t, listResult.Entries[1].Name, "public")
	require.Equal(t, listResult.Entries[2].Name, "team")

	pathPrivate := keybase1.NewPathWithKbfs(`/private`)
	opid, err = sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)
	err = sfs.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID: opid,
		Path: pathPrivate,
	})
	require.NoError(t, err)
	checkPendingOp(ctx, t, sfs, opid, keybase1.AsyncOps_LIST, pathPrivate, keybase1.Path{}, true)
	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)
	listResult, err = sfs.SimpleFSReadList(ctx, opid)
	require.NoError(t, err)
	require.Len(t, listResult.Entries, 1, "Expected 1 directory entries in listing")
	require.Equal(t, listResult.Entries[0].Name, "jdoe")

	t.Log("List directory before it's created")
	path1 := keybase1.NewPathWithKbfs(`/private/jdoe`)
	opid, err = sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)
	err = sfs.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID: opid,
		Path: path1,
	})
	require.NoError(t, err)
	checkPendingOp(
		ctx, t, sfs, opid, keybase1.AsyncOps_LIST, path1, keybase1.Path{}, true)
	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)
	listResult, err = sfs.SimpleFSReadList(ctx, opid)
	require.NoError(t, err)
	require.Len(t, listResult.Entries, 0,
		"Expected 0 directory entries in listing")

	t.Log("Shouldn't have created the TLF")
	h, err := libkbfs.ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "jdoe", tlf.Private)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	require.Nil(t, rootNode)

	clock.Add(1 * time.Minute)
	syncFS(ctx, t, sfs, "/private/jdoe")

	rev1Time := clock.Now()
	clock.Add(1 * time.Minute)

	// make a temp remote directory + files we will clean up later
	writeRemoteFile(ctx, t, sfs, pathAppend(path1, `test1.txt`), []byte(`foo`))
	syncFS(ctx, t, sfs, "/private/jdoe") // Make a revision.
	writeRemoteFile(ctx, t, sfs, pathAppend(path1, `test2.txt`), []byte(`foo`))
	writeRemoteFile(ctx, t, sfs, pathAppend(path1, `.testfile`), []byte(`foo`))
	opid, err = sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	err = sfs.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID:   opid,
		Path:   path1,
		Filter: keybase1.ListFilter_FILTER_ALL_HIDDEN,
	})
	require.NoError(t, err)

	checkPendingOp(ctx, t, sfs, opid, keybase1.AsyncOps_LIST, path1, keybase1.Path{}, true)
	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)

	listResult, err = sfs.SimpleFSReadList(ctx, opid)
	require.NoError(t, err)
	require.Equal(
		t, "jdoe", listResult.Entries[0].LastWriterUnverified.Username)
	require.Equal(
		t, "jdoe", listResult.Entries[1].LastWriterUnverified.Username)

	require.Len(t, listResult.Entries, 2, "Expected 2 directory entries in listing")

	// Assume we've exhausted the list now, so expect error
	_, err = sfs.SimpleFSReadList(ctx, opid)
	require.Error(t, err)

	// Verify error on double wait
	err = sfs.SimpleFSWait(ctx, opid)
	require.Error(t, err)

	opid, err = sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	err = sfs.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID: opid,
		Path: pathAppend(path1, `test1.txt`),
	})
	require.NoError(t, err)

	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)

	listResult, err = sfs.SimpleFSReadList(ctx, opid)
	require.NoError(t, err)

	require.Len(t, listResult.Entries, 1, "Expected 1 directory entries in listing")
	require.Equal(
		t, "jdoe", listResult.Entries[0].LastWriterUnverified.Username)

	// Assume we've exhausted the list now, so expect error
	_, err = sfs.SimpleFSReadList(ctx, opid)
	require.Error(t, err)

	// Check for hidden files too.
	opid, err = sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)
	err = sfs.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID: opid,
		Path: path1,
	})
	require.NoError(t, err)

	checkPendingOp(ctx, t, sfs, opid, keybase1.AsyncOps_LIST, path1, keybase1.Path{}, true)
	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)
	listResult, err = sfs.SimpleFSReadList(ctx, opid)
	require.NoError(t, err)
	require.Len(
		t, listResult.Entries, 3, "Expected 3 directory entries in listing")

	// A single, requested hidden file shows up even if the filter is on.
	opid, err = sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)
	err = sfs.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID:   opid,
		Path:   pathAppend(path1, `.testfile`),
		Filter: keybase1.ListFilter_FILTER_ALL_HIDDEN,
	})
	require.NoError(t, err)

	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)
	listResult, err = sfs.SimpleFSReadList(ctx, opid)
	require.NoError(t, err)
	require.Len(
		t, listResult.Entries, 1, "Expected 1 directory entries in listing")

	// Test that the first archived revision shows no directory entries.
	pathArchivedRev1 := keybase1.NewPathWithKbfsArchived(
		keybase1.KBFSArchivedPath{
			Path:          `/private/jdoe`,
			ArchivedParam: keybase1.NewKBFSArchivedParamWithRevision(1),
		})
	checkArchived := func(pathArchived keybase1.Path, expected int) {
		opid, err = sfs.SimpleFSMakeOpid(ctx)
		require.NoError(t, err)
		err = sfs.SimpleFSList(ctx, keybase1.SimpleFSListArg{
			OpID: opid,
			Path: pathArchived,
		})
		require.NoError(t, err)

		checkPendingOp(
			ctx, t, sfs, opid, keybase1.AsyncOps_LIST, pathArchived,
			keybase1.Path{}, true)
		err = sfs.SimpleFSWait(ctx, opid)
		require.NoError(t, err)
		listResult, err = sfs.SimpleFSReadList(ctx, opid)
		require.NoError(t, err)
		require.Len(
			t, listResult.Entries, expected,
			"Expected 0 directory entries in listing")
	}
	checkArchived(pathArchivedRev1, 0)

	pathArchivedRev2 := keybase1.NewPathWithKbfsArchived(
		keybase1.KBFSArchivedPath{
			Path:          `/private/jdoe`,
			ArchivedParam: keybase1.NewKBFSArchivedParamWithRevision(2),
		})
	checkArchived(pathArchivedRev2, 1)

	// Same test, with by-time archived paths.
	pathArchivedTime := keybase1.NewPathWithKbfsArchived(
		keybase1.KBFSArchivedPath{
			Path: `/private/jdoe`,
			ArchivedParam: keybase1.NewKBFSArchivedParamWithTime(
				keybase1.ToTime(rev1Time)),
		})
	checkArchived(pathArchivedTime, 0)

	pathArchivedTimeString := keybase1.NewPathWithKbfsArchived(
		keybase1.KBFSArchivedPath{
			Path: `/private/jdoe`,
			ArchivedParam: keybase1.NewKBFSArchivedParamWithTimeString(
				rev1Time.String()),
		})
	checkArchived(pathArchivedTimeString, 0)

	pathArchivedRelTimeString := keybase1.NewPathWithKbfsArchived(
		keybase1.KBFSArchivedPath{
			Path: `/private/jdoe`,
			ArchivedParam: keybase1.NewKBFSArchivedParamWithRelTimeString(
				"45s"),
		})
	checkArchived(pathArchivedRelTimeString, 0)

	clock.Add(1 * time.Minute)
	pathArchivedRelTimeString = keybase1.NewPathWithKbfsArchived(
		keybase1.KBFSArchivedPath{
			Path: `/private/jdoe`,
			ArchivedParam: keybase1.NewKBFSArchivedParamWithRelTimeString(
				"45s"),
		})
	checkArchived(pathArchivedRelTimeString, 1)
}

func TestListRecursive(t *testing.T) {
	ctx := context.Background()
	sfs := newSimpleFS(env.EmptyAppStateUpdater{}, libkbfs.MakeTestConfigOrBust(t, "jdoe"))
	defer closeSimpleFS(ctx, t, sfs)

	t.Log("List directory before it's created")
	pathJDoe := keybase1.NewPathWithKbfs(`/private/jdoe`)
	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)
	err = sfs.SimpleFSListRecursive(ctx, keybase1.SimpleFSListRecursiveArg{
		OpID: opid,
		Path: pathJDoe,
	})
	require.NoError(t, err)
	checkPendingOp(
		ctx, t, sfs, opid, keybase1.AsyncOps_LIST_RECURSIVE, pathJDoe,
		keybase1.Path{}, true)
	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)
	listResult, err := sfs.SimpleFSReadList(ctx, opid)
	require.NoError(t, err)
	require.Len(t, listResult.Entries, 0,
		"Expected 0 directory entries in listing")

	// make a temp remote directory + files we will clean up later
	writeRemoteDir(ctx, t, sfs, pathAppend(pathJDoe, `a`))
	patha := keybase1.NewPathWithKbfs(`/private/jdoe/a`)
	writeRemoteDir(ctx, t, sfs, pathAppend(patha, `aa`))
	pathaa := keybase1.NewPathWithKbfs(`/private/jdoe/a/aa`)
	writeRemoteDir(ctx, t, sfs, pathAppend(patha, `ab`))
	pathab := keybase1.NewPathWithKbfs(`/private/jdoe/a/ab`)
	writeRemoteDir(ctx, t, sfs, pathAppend(pathaa, `aaa`))
	pathaaa := keybase1.NewPathWithKbfs(`/private/jdoe/a/aa/aaa`)
	writeRemoteFile(ctx, t, sfs, pathAppend(pathaaa, `test1.txt`), []byte(`foo`))
	writeRemoteFile(ctx, t, sfs, pathAppend(pathab, `test2.txt`), []byte(`foo`))
	writeRemoteFile(ctx, t, sfs, pathAppend(patha, `.testfile`), []byte(`foo`))

	opid, err = sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)
	err = sfs.SimpleFSListRecursive(ctx, keybase1.SimpleFSListRecursiveArg{
		OpID: opid,
		Path: pathJDoe,
	})
	require.NoError(t, err)
	checkPendingOp(ctx, t, sfs, opid, keybase1.AsyncOps_LIST_RECURSIVE, pathJDoe, keybase1.Path{}, true)
	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)
	listResult, err = sfs.SimpleFSReadList(ctx, opid)
	require.NoError(t, err)
	expected := []string{
		"a",
		"a/.testfile",
		"a/aa",
		"a/aa/aaa",
		"a/aa/aaa/test1.txt",
		"a/ab",
		"a/ab/test2.txt",
	}
	require.Len(t, listResult.Entries, len(expected))
	sort.Slice(listResult.Entries, func(i, j int) bool {
		return strings.Compare(listResult.Entries[i].Name,
			listResult.Entries[j].Name) < 0
	})
	for i, e := range expected {
		require.Equal(t, e, listResult.Entries[i].Name)
	}

	opid, err = sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)
	err = sfs.SimpleFSListRecursiveToDepth(ctx, keybase1.SimpleFSListRecursiveToDepthArg{
		OpID:  opid,
		Path:  patha,
		Depth: 1,
	})
	require.NoError(t, err)
	checkPendingOp(ctx, t, sfs, opid, keybase1.AsyncOps_LIST_RECURSIVE_TO_DEPTH, patha, keybase1.Path{}, true)
	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)
	listResult, err = sfs.SimpleFSReadList(ctx, opid)
	require.NoError(t, err)
	expected = []string{
		".testfile",
		"aa",
		"aa/aaa",
		"ab",
		"ab/test2.txt",
	}
	require.Len(t, listResult.Entries, len(expected))
	sort.Slice(listResult.Entries, func(i, j int) bool {
		return strings.Compare(listResult.Entries[i].Name,
			listResult.Entries[j].Name) < 0
	})
	for i, e := range expected {
		require.Equal(t, e, listResult.Entries[i].Name)
	}
}

func TestCopyToLocal(t *testing.T) {
	ctx := context.Background()
	sfs := newSimpleFS(env.EmptyAppStateUpdater{}, libkbfs.MakeTestConfigOrBust(t, "jdoe"))
	defer closeSimpleFS(ctx, t, sfs)

	// make a temp remote directory + file(s) we will clean up later
	path1 := keybase1.NewPathWithKbfs(`/private/jdoe`)
	writeRemoteFile(ctx, t, sfs, pathAppend(path1, "test1.txt"), []byte("foo"))

	// make a temp local dest directory + files we will clean up later
	tempdir2, err := ioutil.TempDir("", "simpleFstest")
	defer os.RemoveAll(tempdir2)
	require.NoError(t, err)
	path2 := keybase1.NewPathWithLocal(tempdir2)

	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	srcPath := pathAppend(path1, "test1.txt")
	destPath := pathAppend(path2, "test1.txt")

	err = sfs.SimpleFSCopy(ctx, keybase1.SimpleFSCopyArg{
		OpID: opid,
		Src:  srcPath,
		Dest: destPath,
	})
	require.NoError(t, err)

	checkPendingOp(ctx, t, sfs, opid, keybase1.AsyncOps_COPY, srcPath, destPath, true)
	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)

	checkPendingOp(ctx, t, sfs, opid, keybase1.AsyncOps_COPY, srcPath, destPath, false)
	// Verify error on double wait
	err = sfs.SimpleFSWait(ctx, opid)
	require.Error(t, err)

	exists, err := libkb.FileExists(filepath.Join(tempdir2, "test1.txt"))
	require.NoError(t, err)
	require.True(t, exists, "File copy destination must exist")
}

func TestCopyRecursive(t *testing.T) {
	ctx := context.Background()
	sfs := newSimpleFS(env.EmptyAppStateUpdater{}, libkbfs.MakeTestConfigOrBust(t, "jdoe"))
	defer closeSimpleFS(ctx, t, sfs)

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFstest")
	require.NoError(t, err)
	defer os.RemoveAll(tempdir)

	// First try copying from a TLF that doesn't exist yet, which
	// shouldn't do anything.
	testdir := filepath.Join(tempdir, "testdir")
	pathLocal := keybase1.NewPathWithLocal(filepath.ToSlash(testdir))
	pathKbfsEmpty := keybase1.NewPathWithKbfs(`/private/jdoe`)
	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)
	err = sfs.SimpleFSCopyRecursive(ctx, keybase1.SimpleFSCopyRecursiveArg{
		OpID: opid,
		Src:  pathKbfsEmpty,
		Dest: pathLocal,
	})
	require.NoError(t, err)
	checkPendingOp(
		ctx, t, sfs, opid, keybase1.AsyncOps_COPY, pathKbfsEmpty, pathLocal,
		true)
	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)
	d, err := os.Open(testdir)
	require.NoError(t, err)
	fis, err := d.Readdir(0)
	require.NoError(t, err)
	require.Len(t, fis, 0)

	// Populate local starting directory.
	err = ioutil.WriteFile(
		filepath.Join(tempdir, "testdir", "test1.txt"), []byte("foo"), 0600)
	require.NoError(t, err)
	err = ioutil.WriteFile(
		filepath.Join(tempdir, "testdir", "test2.txt"), []byte("bar"), 0600)
	require.NoError(t, err)

	opid, err = sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	// Copy it into KBFS.
	pathKbfs := keybase1.NewPathWithKbfs(`/private/jdoe/testdir`)
	err = sfs.SimpleFSCopyRecursive(ctx, keybase1.SimpleFSCopyRecursiveArg{
		OpID: opid,
		Src:  pathLocal,
		Dest: pathKbfs,
	})
	require.NoError(t, err)
	checkPendingOp(
		ctx, t, sfs, opid, keybase1.AsyncOps_COPY, pathLocal, pathKbfs, true)
	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)

	require.Equal(t, "foo",
		string(readRemoteFile(ctx, t, sfs, pathAppend(pathKbfs, "test1.txt"))))
	require.Equal(t, "bar",
		string(readRemoteFile(ctx, t, sfs, pathAppend(pathKbfs, "test2.txt"))))

	// Copy it back.
	tempdir2, err := ioutil.TempDir("", "simpleFstest")
	require.NoError(t, err)
	defer os.RemoveAll(tempdir2)
	path3 := keybase1.NewPathWithLocal(
		filepath.ToSlash(filepath.Join(tempdir2, "testdir")))
	opid2, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)
	err = sfs.SimpleFSCopyRecursive(ctx, keybase1.SimpleFSCopyRecursiveArg{
		OpID: opid2,
		Src:  pathKbfs,
		Dest: path3,
	})
	require.NoError(t, err)
	checkPendingOp(
		ctx, t, sfs, opid2, keybase1.AsyncOps_COPY, pathKbfs, path3, true)
	err = sfs.SimpleFSWait(ctx, opid2)
	require.NoError(t, err)
	dataFoo, err := ioutil.ReadFile(
		filepath.Join(tempdir2, "testdir", "test1.txt"))
	require.NoError(t, err)
	require.Equal(t, "foo", string(dataFoo))
	dataBar, err := ioutil.ReadFile(
		filepath.Join(tempdir2, "testdir", "test2.txt"))
	require.NoError(t, err)
	require.Equal(t, "bar", string(dataBar))

	// Get current revision number for the KBFS files.
	syncFS(ctx, t, sfs, "/private/jdoe")
	fb, _, err := sfs.getFolderBranchFromPath(ctx, pathKbfs)
	require.NoError(t, err)
	status, _, err := sfs.config.KBFSOps().FolderStatus(ctx, fb)
	require.NoError(t, err)
	rev := status.Revision
	pathKbfsArchived := keybase1.NewPathWithKbfsArchived(
		keybase1.KBFSArchivedPath{
			Path: `/private/jdoe/testdir`,
			ArchivedParam: keybase1.NewKBFSArchivedParamWithRevision(
				keybase1.KBFSRevision(rev)),
		})

	// Overwrite the files in KBFS.
	writeRemoteFile(
		ctx, t, sfs, pathAppend(pathKbfs, `test1.txt`), []byte(`foo2`))
	writeRemoteFile(
		ctx, t, sfs, pathAppend(pathKbfs, `test2.txt`), []byte(`bar2`))
	syncFS(ctx, t, sfs, "/private/jdoe")
	require.Equal(t, "foo2",
		string(readRemoteFile(ctx, t, sfs, pathAppend(pathKbfs, "test1.txt"))))
	require.Equal(t, "bar2",
		string(readRemoteFile(ctx, t, sfs, pathAppend(pathKbfs, "test2.txt"))))

	// Read old data from archived path.
	require.Equal(t, "foo",
		string(readRemoteFile(
			ctx, t, sfs, pathAppend(pathKbfsArchived, "test1.txt"))))
	require.Equal(t, "bar",
		string(readRemoteFile(
			ctx, t, sfs, pathAppend(pathKbfsArchived, "test2.txt"))))
}

func TestCopyToRemote(t *testing.T) {
	ctx := context.Background()
	sfs := newSimpleFS(env.EmptyAppStateUpdater{}, libkbfs.MakeTestConfigOrBust(t, "jdoe"))
	defer closeSimpleFS(ctx, t, sfs)

	// make a temp remote directory + file(s) we will clean up later
	path2 := keybase1.NewPathWithKbfs(`/private/jdoe`)

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFstest")
	defer os.RemoveAll(tempdir)
	require.NoError(t, err)
	path1 := keybase1.NewPathWithLocal(tempdir)
	defer deleteTempLocalPath(path1)
	err = ioutil.WriteFile(filepath.Join(path1.Local(), "test1.txt"), []byte("foo"), 0644)
	require.NoError(t, err)

	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	srcPath := keybase1.NewPathWithLocal(
		filepath.ToSlash(filepath.Join(path1.Local(), "test1.txt")))
	destPath := pathAppend(path2, "test1.txt")
	err = sfs.SimpleFSCopy(ctx, keybase1.SimpleFSCopyArg{
		OpID: opid,
		Src:  srcPath,
		Dest: destPath,
	})
	require.NoError(t, err)

	checkPendingOp(ctx, t, sfs, opid, keybase1.AsyncOps_COPY, srcPath, destPath, true)

	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)

	checkPendingOp(ctx, t, sfs, opid, keybase1.AsyncOps_COPY, srcPath, destPath, false)

	// Verify error on double wait
	err = sfs.SimpleFSWait(ctx, opid)
	require.Error(t, err)

	require.Equal(t, `foo`,
		string(readRemoteFile(ctx, t, sfs, pathAppend(path2, "test1.txt"))))
}

func writeRemoteFile(ctx context.Context, t *testing.T, sfs *SimpleFS, path keybase1.Path, data []byte) {
	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	err = sfs.SimpleFSOpen(ctx, keybase1.SimpleFSOpenArg{
		OpID:  opid,
		Dest:  path,
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

func writeRemoteDir(ctx context.Context, t *testing.T, sfs *SimpleFS, path keybase1.Path) {
	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	err = sfs.SimpleFSOpen(ctx, keybase1.SimpleFSOpenArg{
		OpID:  opid,
		Dest:  path,
		Flags: keybase1.OpenFlags_REPLACE | keybase1.OpenFlags_WRITE | keybase1.OpenFlags_DIRECTORY,
	})
	defer sfs.SimpleFSClose(ctx, opid)
	require.NoError(t, err)
}

func readRemoteFile(ctx context.Context, t *testing.T, sfs *SimpleFS, path keybase1.Path) []byte {
	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	de, err := sfs.SimpleFSStat(ctx, keybase1.SimpleFSStatArg{Path: path})
	require.NoError(t, err)
	t.Logf("Stat remote %q %d bytes", path, de.Size)

	err = sfs.SimpleFSOpen(ctx, keybase1.SimpleFSOpenArg{
		OpID:  opid,
		Dest:  path,
		Flags: keybase1.OpenFlags_READ | keybase1.OpenFlags_EXISTING,
	})
	defer sfs.SimpleFSClose(ctx, opid)
	require.NoError(t, err)

	data, err := sfs.SimpleFSRead(ctx, keybase1.SimpleFSReadArg{
		OpID:   opid,
		Offset: 0,
		Size:   de.Size * 2, // Check that reading past the end works.
	})
	require.NoError(t, err)
	require.Len(t, data.Data, de.Size)

	// Starting the read past the end shouldn't matter either.
	dataPastEnd, err := sfs.SimpleFSRead(ctx, keybase1.SimpleFSReadArg{
		OpID:   opid,
		Offset: int64(de.Size),
		Size:   de.Size,
	})
	require.NoError(t, err)
	require.Len(t, dataPastEnd.Data, 0)

	return data.Data
}

type fsBlocker struct {
	*libfs.FS
	signalCh  chan<- struct{}
	unblockCh <-chan struct{}
}

var _ billy.Filesystem = (*fsBlocker)(nil)

func (fs *fsBlocker) OpenFile(filename string, flag int, perm os.FileMode) (
	f billy.File, err error) {
	fs.signalCh <- struct{}{}
	<-fs.unblockCh
	return fs.FS.OpenFile(filename, flag, perm)
}

func (fs *fsBlocker) Create(filename string) (billy.File, error) {
	fs.signalCh <- struct{}{}
	<-fs.unblockCh
	return fs.FS.Create(filename)
}

func (fs *fsBlocker) Open(filename string) (billy.File, error) {
	fs.signalCh <- struct{}{}
	<-fs.unblockCh
	return fs.FS.Open(filename)
}

func (fs *fsBlocker) MkdirAll(filename string, perm os.FileMode) (err error) {
	fs.signalCh <- struct{}{}
	<-fs.unblockCh
	return fs.FS.MkdirAll(filename, perm)
}

func (fs *fsBlocker) ReadDir(p string) (fis []os.FileInfo, err error) {
	fs.signalCh <- struct{}{}
	<-fs.unblockCh
	return fs.FS.ReadDir(p)
}

type fsBlockerMaker struct {
	signalCh  chan<- struct{}
	unblockCh <-chan struct{}
}

func (maker fsBlockerMaker) makeNewBlocker(
	ctx context.Context, config libkbfs.Config,
	tlfHandle *libkbfs.TlfHandle, branch libkbfs.BranchName, subdir string,
	create bool) (billy.Filesystem, error) {
	fsMaker := libfs.NewFS
	if !create {
		fsMaker = libfs.NewFSIfExists
	}
	fs, err := fsMaker(
		ctx, config, tlfHandle, branch, subdir, "", keybase1.MDPriorityNormal)
	if err != nil {
		return nil, err
	}
	return &fsBlocker{fs, maker.signalCh, maker.unblockCh}, nil
}

func TestCopyProgress(t *testing.T) {
	ctx := context.Background()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	clock := &libkbfs.TestClock{}
	start := time.Now()
	clock.Set(start)
	config.SetClock(clock)

	sfs := newSimpleFS(env.EmptyAppStateUpdater{}, config)
	defer closeSimpleFS(ctx, t, sfs)

	waitCh := make(chan struct{})
	unblockCh := make(chan struct{})
	maker := fsBlockerMaker{waitCh, unblockCh}
	sfs.newFS = maker.makeNewBlocker

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFstest")
	require.NoError(t, err)
	defer os.RemoveAll(tempdir)

	// Make local starting directory.
	err = os.Mkdir(filepath.Join(tempdir, "testdir"), 0700)
	require.NoError(t, err)
	err = ioutil.WriteFile(
		filepath.Join(tempdir, "testdir", "test1.txt"), []byte("foo"), 0600)
	require.NoError(t, err)
	err = ioutil.WriteFile(
		filepath.Join(tempdir, "testdir", "test2.txt"), []byte("bar"), 0600)
	require.NoError(t, err)
	path1 := keybase1.NewPathWithLocal(
		filepath.ToSlash(filepath.Join(tempdir, "testdir")))
	path2 := keybase1.NewPathWithKbfs(`/private/jdoe/testdir`)

	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	// Copy it into KBFS.
	err = sfs.SimpleFSCopyRecursive(ctx, keybase1.SimpleFSCopyRecursiveArg{
		OpID: opid,
		Src:  path1,
		Dest: path2,
	})
	require.NoError(t, err)
	checkPendingOp(
		ctx, t, sfs, opid, keybase1.AsyncOps_COPY, path1, path2, true)

	t.Log("Wait for the first mkdir")
	waitFn := func() {
		select {
		case <-waitCh:
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		}
	}
	waitFn()

	// Check the progress -- there shouldn't be any yet.
	progress, err := sfs.SimpleFSCheck(ctx, opid)
	require.NoError(t, err)
	expectedProgress := keybase1.OpProgress{
		Start:      keybase1.ToTime(start),
		OpType:     keybase1.AsyncOps_COPY,
		BytesTotal: 6,
		FilesTotal: 3,
	}
	require.Equal(t, expectedProgress, progress)

	t.Log("Unblock the mkdir")
	unblockCh <- struct{}{}

	t.Log("Wait for the first file")
	waitFn()

	clock.Add(1 * time.Minute)
	expectedProgress.FilesRead = 1
	expectedProgress.FilesWritten = 1
	// We read one directory but 0 bytes, so we still have no expected
	// end time.
	progress, err = sfs.SimpleFSCheck(ctx, opid)
	require.NoError(t, err)
	require.Equal(t, expectedProgress, progress)

	t.Log("Unblock the first file")
	unblockCh <- struct{}{}

	t.Log("Wait for the second file")
	waitFn()

	clock.Add(1 * time.Minute)
	expectedProgress.FilesRead = 2
	expectedProgress.FilesWritten = 2
	expectedProgress.BytesRead = 3
	expectedProgress.BytesWritten = 3
	progress, err = sfs.SimpleFSCheck(ctx, opid)
	require.NoError(t, err)

	// We read one file and two minutes have passed, so the estimated
	// time should be two more minutes from now.  But use the float
	// calculation adds some uncertainty, so check it within a small
	// error range, and then set it to the received value for the
	// exact check.
	endEstimate := keybase1.ToTime(start.Add(4 * time.Minute))
	require.InEpsilon(
		t, float64(endEstimate), float64(progress.EndEstimate),
		float64(5*time.Nanosecond))
	expectedProgress.EndEstimate = progress.EndEstimate

	require.Equal(t, expectedProgress, progress)

	t.Log("Unblock the second file")
	unblockCh <- struct{}{}

	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)
}

func TestTlfEditHistory(t *testing.T) {
	ctx := context.Background()
	sfs := newSimpleFS(
		env.EmptyAppStateUpdater{},
		libkbfs.MakeTestConfigOrBust(t, "jdoe"))
	defer closeSimpleFS(ctx, t, sfs)

	path := keybase1.NewPathWithKbfs(`/private/jdoe`)
	writeRemoteFile(ctx, t, sfs, pathAppend(path, `test1.txt`), []byte(`foo`))
	writeRemoteFile(ctx, t, sfs, pathAppend(path, `test2.txt`), []byte(`foo`))
	syncFS(ctx, t, sfs, "/private/jdoe")

	history, err := sfs.SimpleFSFolderEditHistory(ctx, path)
	require.NoError(t, err)
	require.Len(t, history.History, 1)
	require.Equal(t, "jdoe", history.History[0].WriterName)
	require.Len(t, history.History[0].Edits, 2)
}

type subscriptionReporter struct {
	libkbfs.Reporter
	lastPath string
}

func (sr *subscriptionReporter) NotifyPathUpdated(
	_ context.Context, path string) {
	sr.lastPath = path
}

func TestRefreshSubscription(t *testing.T) {
	ctx := context.Background()
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	sfs := newSimpleFS(env.EmptyAppStateUpdater{}, config)
	defer closeSimpleFS(ctx, t, sfs)
	sr := &subscriptionReporter{config.Reporter(), ""}
	config.SetReporter(sr)

	path1 := keybase1.NewPathWithKbfs(`/private/jdoe`)

	t.Log("Writing a file with no subscription")
	writeRemoteFile(ctx, t, sfs, pathAppend(path1, `test1.txt`), []byte(`foo`))
	syncFS(ctx, t, sfs, "/private/jdoe")
	require.Equal(t, "", sr.lastPath)

	t.Log("Subscribe, and make sure we get a notification")
	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)
	err = sfs.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID:                opid,
		Path:                path1,
		RefreshSubscription: true,
	})
	require.NoError(t, err)
	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)

	writeRemoteFile(ctx, t, sfs, pathAppend(path1, `test2.txt`), []byte(`foo`))
	syncFS(ctx, t, sfs, "/private/jdoe")
	require.Equal(t, "/keybase"+path1.Kbfs(), sr.lastPath)

	t.Log("Make a public TLF")
	path2 := keybase1.NewPathWithKbfs(`/public/jdoe`)
	writeRemoteFile(ctx, t, sfs, pathAppend(path2, `test.txt`), []byte(`foo`))
	syncFS(ctx, t, sfs, "/public/jdoe")

	// now subscribe to a different one, and make sure the old
	// subscription goes away.
	opid2, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)
	err = sfs.SimpleFSList(ctx, keybase1.SimpleFSListArg{
		OpID:                opid2,
		Path:                path2,
		RefreshSubscription: true,
	})
	require.NoError(t, err)
	err = sfs.SimpleFSWait(ctx, opid2)
	require.NoError(t, err)

	writeRemoteFile(ctx, t, sfs, pathAppend(path2, `test2.txt`), []byte(`foo`))
	syncFS(ctx, t, sfs, "/public/jdoe")
	require.Equal(t, "/keybase"+path2.Kbfs(), sr.lastPath)

	writeRemoteFile(ctx, t, sfs, pathAppend(path1, `test3.txt`), []byte(`foo`))
	syncFS(ctx, t, sfs, "/private/jdoe")
	require.Equal(t, "/keybase"+path2.Kbfs(), sr.lastPath)
}

func TestGetRevisions(t *testing.T) {
	ctx := context.Background()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	clock := &libkbfs.TestClock{}
	start := time.Now()
	clock.Set(start)
	config.SetClock(clock)

	sfs := newSimpleFS(env.EmptyAppStateUpdater{}, config)
	defer closeSimpleFS(ctx, t, sfs)

	path := keybase1.NewPathWithKbfs(`/private/jdoe`)
	filePath := pathAppend(path, `test1.txt`)

	getRevisions := func(
		spanType keybase1.RevisionSpanType) keybase1.GetRevisionsResult {
		opid, err := sfs.SimpleFSMakeOpid(ctx)
		require.NoError(t, err)
		err = sfs.SimpleFSGetRevisions(ctx, keybase1.SimpleFSGetRevisionsArg{
			OpID:     opid,
			Path:     filePath,
			SpanType: spanType,
		})
		require.NoError(t, err)
		err = sfs.SimpleFSWait(ctx, opid)
		require.NoError(t, err)
		res, err := sfs.SimpleFSReadRevisions(ctx, opid)
		require.NoError(t, err)
		err = sfs.SimpleFSClose(ctx, opid)
		require.NoError(t, err)
		return res
	}

	gcJump := config.Mode().QuotaReclamationMinUnrefAge() + 1*time.Second
	checkRevisions := func(
		numExpected, newestRev int, spanType keybase1.RevisionSpanType) {
		res := getRevisions(spanType)
		require.Len(t, res.Revisions, numExpected)

		// Default should get the most recent one, and then the 4
		// earliest ones, while LAST_FIVE should get the last five.
		expectedTime := clock.Now()
		expectedRev := keybase1.KBFSRevision(newestRev)
		for i, r := range res.Revisions {
			require.Equal(t, keybase1.ToTime(expectedTime), r.Entry.Time, fmt.Sprintf("%d %d", i, r.Revision))
			require.Equal(t, expectedRev, r.Revision)
			expectedTime = expectedTime.Add(-1 * time.Minute)
			expectedRev--
			// Adjust for the skip-list when the list is full.
			if newestRev == 7 && i == 3 &&
				spanType == keybase1.RevisionSpanType_DEFAULT {
				expectedTime = expectedTime.Add(-1 * time.Minute)
				expectedRev--
			} else if newestRev == 9 && i == 0 {
				expectedTime = expectedTime.Add(-gcJump)
			}
		}
	}

	t.Log("Write 6 revisions of a single file, spaced out a minute each")
	for i := 0; i < 6; i++ {
		clock.Add(1 * time.Minute)
		writeRemoteFile(ctx, t, sfs, filePath, []byte{byte(i)})
		syncFS(ctx, t, sfs, "/private/jdoe")
		numExpected := i + 1
		if numExpected > 5 {
			numExpected = 5
		}
		checkRevisions(numExpected, i+2, keybase1.RevisionSpanType_DEFAULT)
		checkRevisions(numExpected, i+2, keybase1.RevisionSpanType_LAST_FIVE)
	}

	t.Log("Jump the clock forward and force quota reclamation")
	clock.Add(gcJump)
	fb, _, err := sfs.getFolderBranchFromPath(ctx, path)
	require.NoError(t, err)
	libkbfs.ForceQuotaReclamationForTesting(config, fb)
	err = config.KBFSOps().SyncFromServer(ctx, fb, nil)
	require.NoError(t, err)
	syncFS(ctx, t, sfs, "/private/jdoe")

	t.Log("Make a new revision after QR")
	clock.Add(1 * time.Minute)
	writeRemoteFile(ctx, t, sfs, filePath, []byte{6})
	syncFS(ctx, t, sfs, "/private/jdoe")

	// Now we should be able to see two revisions, since the previous
	// version was live at the time of QR.
	newestRev := 9 /* Last file revision was at 7, plus one for GC */
	checkRevisions(2, newestRev, keybase1.RevisionSpanType_DEFAULT)
	checkRevisions(2, newestRev, keybase1.RevisionSpanType_LAST_FIVE)
}

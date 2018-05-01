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
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	billy "gopkg.in/src-d/go-billy.v4"
)

func closeSimpleFS(ctx context.Context, t *testing.T, fs *SimpleFS) {
	// Sync in-memory data to disk before shutting down and flushing
	// the journal.
	ctx, err := fs.startOpWrapContext(ctx)
	require.NoError(t, err)
	remoteFS, _, err := fs.getFS(ctx, keybase1.NewPathWithKbfs("/private/jdoe"))
	require.NoError(t, err)
	if fs, ok := remoteFS.(*libfs.FS); ok {
		err = fs.SyncAll()
	} else if fs, ok := remoteFS.(*fsBlocker); ok {
		err = fs.SyncAll()
	}
	require.NoError(t, err)
	err = fs.config.Shutdown(ctx)
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
		assert.Len(t, ops, 0, "Expected zero pending operations")
		return
	}

	assert.True(t, len(ops) > 0, "Expected at least one pending operation")

	o := ops[0]
	op, err := o.AsyncOp()
	require.NoError(t, err)
	assert.Equal(t, expectedOp, op, "Expected at least one pending operation")

	// TODO: verify read/write arguments
	switch op {
	case keybase1.AsyncOps_LIST:
		list := o.List()
		assert.Equal(t, list.Path, src, "Expected matching path in operation")
	case keybase1.AsyncOps_LIST_RECURSIVE:
		list := o.ListRecursive()
		assert.Equal(t, list.Path, src, "Expected matching path in operation")
	// TODO: read is not async
	case keybase1.AsyncOps_READ:
		read := o.Read()
		assert.Equal(t, read.Path, src, "Expected matching path in operation")
	// TODO: write is not asynce
	case keybase1.AsyncOps_WRITE:
		write := o.Write()
		assert.Equal(t, write.Path, src, "Expected matching path in operation")
	case keybase1.AsyncOps_COPY:
		copy := o.Copy()
		assert.Equal(t, copy.Src, src, "Expected matching path in operation")
		assert.Equal(t, copy.Dest, dest, "Expected matching path in operation")
	case keybase1.AsyncOps_MOVE:
		move := o.Move()
		assert.Equal(t, move.Src, src, "Expected matching path in operation")
		assert.Equal(t, move.Dest, dest, "Expected matching path in operation")
	case keybase1.AsyncOps_REMOVE:
		remove := o.Remove()
		assert.Equal(t, remove.Path, src, "Expected matching path in operation")
	}
}

func TestList(t *testing.T) {
	ctx := context.Background()
	sfs := newSimpleFS(libkb.NewGlobalContext(), libkbfs.MakeTestConfigOrBust(t, "jdoe"))
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
	assert.Len(t, listResult.Entries, 3, "Expected 3 directory entries in listing")
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
	assert.Len(t, listResult.Entries, 1, "Expected 1 directory entries in listing")
	require.Equal(t, listResult.Entries[0].Name, "jdoe")

	// make a temp remote directory + files we will clean up later
	path1 := keybase1.NewPathWithKbfs(`/private/jdoe`)
	writeRemoteFile(ctx, t, sfs, pathAppend(path1, `test1.txt`), []byte(`foo`))
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

	assert.Len(t, listResult.Entries, 2, "Expected 2 directory entries in listing")

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

	assert.Len(t, listResult.Entries, 1, "Expected 1 directory entries in listing")
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
	assert.Len(
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
	assert.Len(
		t, listResult.Entries, 1, "Expected 1 directory entries in listing")
}

func TestCopyToLocal(t *testing.T) {
	ctx := context.Background()
	sfs := newSimpleFS(libkb.NewGlobalContext(), libkbfs.MakeTestConfigOrBust(t, "jdoe"))
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
	assert.True(t, exists, "File copy destination must exist")
}

func TestCopyRecursive(t *testing.T) {
	ctx := context.Background()
	sfs := newSimpleFS(libkb.NewGlobalContext(), libkbfs.MakeTestConfigOrBust(t, "jdoe"))
	defer closeSimpleFS(ctx, t, sfs)

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
	err = sfs.SimpleFSWait(ctx, opid)
	require.NoError(t, err)

	require.Equal(t, "foo",
		string(readRemoteFile(ctx, t, sfs, pathAppend(path2, "test1.txt"))))
	require.Equal(t, "bar",
		string(readRemoteFile(ctx, t, sfs, pathAppend(path2, "test2.txt"))))

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
		Src:  path2,
		Dest: path3,
	})
	require.NoError(t, err)
	checkPendingOp(
		ctx, t, sfs, opid2, keybase1.AsyncOps_COPY, path2, path3, true)
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
}

func TestCopyToRemote(t *testing.T) {
	ctx := context.Background()
	sfs := newSimpleFS(libkb.NewGlobalContext(), libkbfs.MakeTestConfigOrBust(t, "jdoe"))
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

func readRemoteFile(ctx context.Context, t *testing.T, sfs *SimpleFS, path keybase1.Path) []byte {
	opid, err := sfs.SimpleFSMakeOpid(ctx)
	require.NoError(t, err)

	de, err := sfs.SimpleFSStat(ctx, path)
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
	tlfHandle *libkbfs.TlfHandle, subdir string) (billy.Filesystem, error) {
	fs, err := libfs.NewFS(
		ctx, config, tlfHandle, subdir, "", keybase1.MDPriorityNormal)
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

	sfs := newSimpleFS(libkb.NewGlobalContext(), config)
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

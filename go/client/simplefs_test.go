// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"crypto/rand"
	"errors"
	"io/ioutil"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type SimpleFSMock struct {
	ListResult   *keybase1.SimpleFSListResult
	remoteExists bool // for Stat
	localExists  bool // for Stat
}

// SimpleFSList - Begin list of items in directory at path
// Retrieve results with readList()
// Can be a single file to get flags/status
func (s SimpleFSMock) SimpleFSList(ctx context.Context, arg keybase1.SimpleFSListArg) error {
	return nil
}

// SimpleFSListRecursive - Begin recursive list of items in directory at path
func (s SimpleFSMock) SimpleFSListRecursive(ctx context.Context, arg keybase1.SimpleFSListRecursiveArg) error {
	return nil
}

// SimpleFSListRecursiveToDepth - Begin recursive list of items in directory at
// path to a given depth.
func (s SimpleFSMock) SimpleFSListRecursiveToDepth(ctx context.Context, arg keybase1.SimpleFSListRecursiveToDepthArg) error {
	return nil
}

// SimpleFSReadList - Get list of Paths in progress. Can indicate status of pending
// to get more entries.
func (s SimpleFSMock) SimpleFSReadList(ctx context.Context, arg keybase1.OpID) (keybase1.SimpleFSListResult, error) {
	if len(s.ListResult.Entries) > 0 {
		retval := *s.ListResult
		s.ListResult.Entries = nil
		return retval, nil
	}
	return keybase1.SimpleFSListResult{}, errors.New("no more items to list")
}

// SimpleFSCopy - Begin copy of file or directory
func (s SimpleFSMock) SimpleFSCopy(ctx context.Context, arg keybase1.SimpleFSCopyArg) error {
	return nil
}

// SimpleFSCopyRecursive - Begin recursive copy of directory
func (s SimpleFSMock) SimpleFSCopyRecursive(ctx context.Context, arg keybase1.SimpleFSCopyRecursiveArg) error {
	return nil
}

// SimpleFSSymlink - make a symlink
func (s SimpleFSMock) SimpleFSSymlink(ctx context.Context, arg keybase1.SimpleFSSymlinkArg) error {
	return nil
}

// SimpleFSMove - Begin move of file or directory, from/to KBFS only
func (s SimpleFSMock) SimpleFSMove(ctx context.Context, arg keybase1.SimpleFSMoveArg) error {
	return nil
}

// SimpleFSRename - Rename file or directory, KBFS side only
func (s SimpleFSMock) SimpleFSRename(ctx context.Context, arg keybase1.SimpleFSRenameArg) error {
	return nil
}

// SimpleFSOpen - Create/open a file and leave it open
// or create a directory
// Files must be closed afterwards.
func (s SimpleFSMock) SimpleFSOpen(ctx context.Context, arg keybase1.SimpleFSOpenArg) error {
	return nil
}

// SimpleFSSetStat - Set/clear file bits - only executable for now
func (s SimpleFSMock) SimpleFSSetStat(ctx context.Context, arg keybase1.SimpleFSSetStatArg) error {
	return nil
}

// SimpleFSRead - Read (possibly partial) contents of open file,
// up to the amount specified by size.
// Repeat until zero bytes are returned or error.
// If size is zero, read an arbitrary amount.
func (s SimpleFSMock) SimpleFSRead(ctx context.Context, arg keybase1.SimpleFSReadArg) (keybase1.FileContent, error) {
	return keybase1.FileContent{}, nil
}

// SimpleFSWrite - Append content to opened file.
// May be repeated until OpID is closed.
func (s SimpleFSMock) SimpleFSWrite(ctx context.Context, arg keybase1.SimpleFSWriteArg) error {
	return nil
}

// SimpleFSRemove - Remove file or directory from filesystem
func (s SimpleFSMock) SimpleFSRemove(ctx context.Context, arg keybase1.SimpleFSRemoveArg) error {
	return nil
}

// SimpleFSStat - Get info about file
func (s SimpleFSMock) SimpleFSStat(ctx context.Context, arg keybase1.SimpleFSStatArg) (keybase1.Dirent, error) {
	pathString := arg.Path.String()
	entType := keybase1.DirentType_DIR
	// For a quick test, assume it's a file if there is a dot and 3 chars at the end
	if len(filepath.Ext(filepath.Base(pathString))) == 4 {
		entType = keybase1.DirentType_FILE
	}
	pathType, _ := arg.Path.PathType()
	if (pathType == keybase1.PathType_KBFS && s.remoteExists == true) ||
		(pathType == keybase1.PathType_LOCAL && s.localExists == true) {
		return keybase1.Dirent{
			Name:       pathString,
			DirentType: entType,
		}, nil
	}
	return keybase1.Dirent{}, errors.New(pathString + " does not exist")
}

// SimpleFSGetRevisions - Get revision info for a directory entry
func (s SimpleFSMock) SimpleFSGetRevisions(
	_ context.Context, _ keybase1.SimpleFSGetRevisionsArg) error {
	return nil
}

// SimpleFSReadRevisions - Get list of revisions in progress. Can
// indicate status of pending to get more entries.
func (s SimpleFSMock) SimpleFSReadRevisions(
	_ context.Context, _ keybase1.OpID) (
	keybase1.GetRevisionsResult, error) {
	return keybase1.GetRevisionsResult{}, nil
}

// SimpleFSMakeOpid - Convenience helper for generating new random value
func (s SimpleFSMock) SimpleFSMakeOpid(ctx context.Context) (keybase1.OpID, error) {
	var opid keybase1.OpID
	_, err := rand.Read(opid[:])

	return opid, err
}

// SimpleFSClose - Close OpID, cancels any pending operation.
// Must be called after list/copy/remove
func (s SimpleFSMock) SimpleFSClose(ctx context.Context, arg keybase1.OpID) error {
	return nil
}

// SimpleFSCancel - Cancels a running operation, like copy.
func (s SimpleFSMock) SimpleFSCancel(ctx context.Context, arg keybase1.OpID) error {
	return nil
}

// SimpleFSCheck - Check progress of pending operation
func (s SimpleFSMock) SimpleFSCheck(ctx context.Context, arg keybase1.OpID) (keybase1.OpProgress, error) {
	return keybase1.OpProgress{}, nil
}

// SimpleFSGetOps - Get all the outstanding operations
func (s SimpleFSMock) SimpleFSGetOps(ctx context.Context) ([]keybase1.OpDescription, error) {
	return nil, nil
}

// SimpleFSWait - Blocking wait for the pending operation to finish
func (s SimpleFSMock) SimpleFSWait(ctx context.Context, arg keybase1.OpID) error {
	return nil
}

// SimpleFSDumpDebuggingInfo - Instructs KBFS to dump debugging info
// into its logs.
func (s SimpleFSMock) SimpleFSDumpDebuggingInfo(ctx context.Context) error {
	return nil
}

// SimpleFSDumpDebuggingInfo - Instructs KBFS to dump debugging info
// into its logs.
func (s SimpleFSMock) SimpleFSSyncStatus(ctx context.Context, filter keybase1.ListFilter) (keybase1.FSSyncStatus, error) {
	return keybase1.FSSyncStatus{}, nil
}

// SimpleFSUserEditHistory implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSUserEditHistory(ctx context.Context) (
	res []keybase1.FSFolderEditHistory, err error) {
	return nil, nil
}

// SimpleFSFolderEditHistory implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSFolderEditHistory(
	ctx context.Context, path keybase1.Path) (
	res keybase1.FSFolderEditHistory, err error) {
	return keybase1.FSFolderEditHistory{}, nil
}

// SimpleFSReset implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSReset(
	_ context.Context, _ keybase1.SimpleFSResetArg) error {
	return nil
}

func (s SimpleFSMock) SimpleFSClearConflictState(_ context.Context,
	_ keybase1.Path) error {
	return nil
}

func (s SimpleFSMock) SimpleFSFinishResolvingConflict(_ context.Context,
	_ keybase1.Path) error {
	return nil
}

func (s SimpleFSMock) SimpleFSForceStuckConflict(_ context.Context,
	_ keybase1.Path) error {
	return nil
}

func (s SimpleFSMock) SimpleFSListFavorites(_ context.Context) (
	keybase1.FavoritesResult, error) {
	return keybase1.FavoritesResult{}, nil
}

// SimpleFSGetUserQuotaUsage implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSGetUserQuotaUsage(ctx context.Context) (
	keybase1.SimpleFSQuotaUsage, error) {
	return keybase1.SimpleFSQuotaUsage{}, nil
}

// SimpleFSGetTeamQuotaUsage implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSGetTeamQuotaUsage(
	_ context.Context, _ keybase1.TeamName) (
	keybase1.SimpleFSQuotaUsage, error) {
	return keybase1.SimpleFSQuotaUsage{}, nil
}

// SimpleFSGetFolder implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSGetFolder(
	_ context.Context, _ keybase1.KBFSPath) (
	res keybase1.FolderWithFavFlags, err error) {
	return res, nil
}

// SimpleFSFolderSyncConfigAndStatus implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSFolderSyncConfigAndStatus(
	_ context.Context, _ keybase1.Path) (
	keybase1.FolderSyncConfigAndStatus, error) {
	return keybase1.FolderSyncConfigAndStatus{}, nil
}

// SimpleFSFolderSetSyncConfig implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSSetFolderSyncConfig(
	_ context.Context, _ keybase1.SimpleFSSetFolderSyncConfigArg) error {
	return nil
}

// SimpleFSSyncConfigAndStatus implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSSyncConfigAndStatus(
	_ context.Context, _ *keybase1.TLFIdentifyBehavior) (keybase1.SyncConfigAndStatusRes, error) {
	return keybase1.SyncConfigAndStatusRes{}, nil
}

// SimpleFSAreWeConnectedToMDServer implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSAreWeConnectedToMDServer(
	_ context.Context) (bool, error) {
	return true, nil
}

// SimpleFSCheckReachability implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSCheckReachability(
	_ context.Context) error {
	return nil
}

// SimpleFSSetDebugLevel implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSSetDebugLevel(_ context.Context, _ string) error {
	return nil
}

// SimpleFSSettings implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSSettings(_ context.Context) (keybase1.FSSettings, error) {
	return keybase1.FSSettings{}, nil
}

// SimpleFSSetNotificationThreshold implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSSetNotificationThreshold(_ context.Context, _ int64) error {
	return nil
}

// SimpleFSObfuscatePath implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSObfuscatePath(
	_ context.Context, _ keybase1.Path) (string, error) {
	return "", nil
}

// SimpleFSDeobfuscatePath implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSDeobfuscatePath(
	_ context.Context, _ keybase1.Path) ([]string, error) {
	return nil, nil
}

// SimpleFSGetStats implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSGetStats(_ context.Context) (
	keybase1.SimpleFSStats, error) {
	return keybase1.SimpleFSStats{}, nil
}

// SimpleFSSubscribeNonPath implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSSubscribeNonPath(ctx context.Context, arg keybase1.SimpleFSSubscribeNonPathArg) error {
	return nil
}

// SimpleFSSubscribePath implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSSubscribePath(ctx context.Context, arg keybase1.SimpleFSSubscribePathArg) error {
	return nil
}

// SimpleFSUnsubscribe implements the SimpleFSInterface.
func (s SimpleFSMock) SimpleFSUnsubscribe(ctx context.Context, arg keybase1.SimpleFSUnsubscribeArg) error {
	return nil
}

func (s SimpleFSMock) SimpleFSStartDownload(
	ctx context.Context, arg keybase1.SimpleFSStartDownloadArg) (downloadID string, err error) {
	return "", nil
}

func (s SimpleFSMock) SimpleFSGetDownloadStatus(ctx context.Context) (
	status keybase1.DownloadStatus, err error) {
	return keybase1.DownloadStatus{}, nil
}

func (s SimpleFSMock) SimpleFSDismissDownload(
	ctx context.Context, downloadID string) (err error) {
	return nil
}

func (s SimpleFSMock) SimpleFSCancelDownload(
	ctx context.Context, downloadID string) (err error) {
	return nil
}

func (s SimpleFSMock) SimpleFSGetDownloadInfo(
	ctx context.Context, downloadID string) (downloadInfo keybase1.DownloadInfo, err error) {
	return keybase1.DownloadInfo{}, nil
}

func (s SimpleFSMock) SimpleFSConfigureDownload(
	ctx context.Context, arg keybase1.SimpleFSConfigureDownloadArg) (err error) {
	return nil
}

func (s SimpleFSMock) SimpleFSGetGUIFileContext(ctx context.Context,
	path keybase1.KBFSPath) (resource keybase1.GUIFileContext, err error) {
	return keybase1.GUIFileContext{}, nil
}

func (s SimpleFSMock) SimpleFSGetFilesTabBadge(_ context.Context) (
	keybase1.FilesTabBadge, error) {
	return keybase1.FilesTabBadge_NONE, nil
}

/*
 file source cases:
 1. file
 2. dir

 file source/dest types:
 1. kbfs
 2. local

 file dest cases:
 1. file
 2. dir
 3. not found
*/

func TestSimpleFSPathRemote(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)
	defer tc.Cleanup()

	testPath, err := makeSimpleFSPath("/keybase/private/foobar")
	require.NoError(tc.T, err)
	pathType, err := testPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_KBFS, pathType, "Expected remote path, got local %s", testPath)
	assert.Equal(tc.T, "/private/foobar", testPath.Kbfs().Path)

	testPath, err = makeSimpleFSPath("/keybase/private/")
	require.NoError(tc.T, err)
	pathType, err = testPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_KBFS, pathType, "Expected remote path, got local")
	assert.Equal(tc.T, "/private", testPath.Kbfs().Path)

}

func TestSimpleFSPathLocal(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)
	defer tc.Cleanup()

	testPath, err := makeSimpleFSPath("./foobar")
	require.NoError(tc.T, err)
	pathType, err := testPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_LOCAL, pathType, "Expected local path, got remote")
}

func TestSimpleFSLocalSrcFile(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)
	defer tc.Cleanup()

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFStest")
	defer os.RemoveAll(tempdir)
	require.NoError(t, err)
	path1 := keybase1.NewPathWithLocal(filepath.Join(tempdir, "test1.txt"))
	err = ioutil.WriteFile(path1.Local(), []byte("foo"), 0644)
	require.NoError(t, err)

	isSrcDir, srcPathString, err := checkPathIsDir(context.TODO(), SimpleFSMock{localExists: true}, path1)
	require.NoError(tc.T, err, "bad path type")
	require.False(tc.T, isSrcDir)
	require.Equal(tc.T, path1.Local(), srcPathString)

	// Destination file not given
	destPath, err := makeSimpleFSPath("/keybase/public/foobar")
	require.NoError(tc.T, err)

	isDestDir, destPathString, err := checkPathIsDir(context.TODO(), SimpleFSMock{remoteExists: true}, destPath)
	require.NoError(tc.T, err, "bad path type")
	require.True(tc.T, isDestDir)
	require.Equal(tc.T, "/public/foobar", destPathString)

	destPath, err = makeDestPath(
		context.TODO(),
		tc.G,
		SimpleFSMock{},
		path1,
		destPath,
		true,
		"/public/foobar")
	assert.Equal(tc.T, "/public/foobar/test1.txt", destPath.Kbfs().Path)
	require.NoError(tc.T, err, "bad path type")

	pathType, err := destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_KBFS, pathType, "Expected remote path, got local")

	assert.Equal(tc.T, "/public/foobar/test1.txt", destPath.Kbfs().Path)

	// Destination file given
	destPath, err = makeDestPath(
		context.TODO(),
		tc.G,
		SimpleFSMock{},
		path1,
		destPath,
		true,
		"/public/foobar")
	assert.Equal(tc.T, "/public/foobar/test1.txt", destPath.Kbfs().Path)
	require.NoError(tc.T, err, "bad path type")

	pathType, err = destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_KBFS, pathType, "Expected remote path, got local")

	assert.Equal(tc.T, "/public/foobar/test1.txt", destPath.Kbfs().Path)

}

func TestSimpleFSRemoteSrcFile(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)
	defer tc.Cleanup()

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFstest")
	defer os.RemoveAll(tempdir)
	require.NoError(t, err)

	tempdir = filepath.ToSlash(tempdir)

	destPath, err := makeSimpleFSPath(tempdir)
	require.NoError(tc.T, err)
	srcPath, err := makeSimpleFSPath("/keybase/public/foobar/test1.txt")
	require.NoError(tc.T, err)

	// Destination file not included in path
	destPath, err = makeDestPath(
		context.TODO(),
		tc.G,
		SimpleFSMock{remoteExists: true},
		srcPath,
		destPath,
		true,
		tempdir)
	exists, err2 := libkb.FileExists(destPath.Local())
	tc.G.Log.Debug("makeDestPath fileExists %s: %v, %v", destPath.Local(), exists, err2)

	require.NoError(tc.T, err, "makeDestPath returns %s", destPath)

	isSrcDir, srcPathString, err := checkPathIsDir(context.TODO(), SimpleFSMock{remoteExists: true}, srcPath)
	require.NoError(tc.T, err)
	require.Equal(tc.T, "/public/foobar/test1.txt", srcPath.Kbfs().Path)
	require.False(tc.T, isSrcDir)
	require.Equal(tc.T, "/public/foobar/test1.txt", srcPathString)
	require.Equal(tc.T, "test1.txt", filepath.Base(srcPathString))

	pathType, err := destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_LOCAL, pathType, "Expected local path, got remote")

	assert.Equal(tc.T, filepath.ToSlash(filepath.Join(tempdir, "test1.txt")), destPath.Local())

	// Dest file included in path
	destPath, err = makeDestPath(
		context.TODO(),
		tc.G,
		SimpleFSMock{remoteExists: true},
		srcPath,
		destPath,
		true,
		tempdir)

	require.NoError(tc.T, err, "makeDestPath returns %s", destPath)

	pathType, err = destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_LOCAL, pathType, "Expected local path, got remote")

	assert.Equal(tc.T, filepath.ToSlash(filepath.Join(tempdir, "test1.txt")), destPath.Local())
}

func TestSimpleFSLocalSrcDir(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)
	defer tc.Cleanup()

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFStest")
	defer os.RemoveAll(tempdir)
	require.NoError(t, err)
	path1 := keybase1.NewPathWithLocal(tempdir)
	require.NoError(t, err)
	testStatter := SimpleFSMock{localExists: true}

	isSrcDir, srcPathString, err := checkPathIsDir(context.TODO(), testStatter, path1)
	require.NoError(tc.T, err, "bad path type")
	require.True(tc.T, isSrcDir)
	require.Equal(tc.T, path1.Local(), srcPathString)

	destPathInitial, err := makeSimpleFSPath("/keybase/public/foobar")
	require.NoError(tc.T, err)

	// Test when dest. exists.
	// We append the last element of the source in that case.
	testStatter.remoteExists = true
	isDestDir, destPathString, err := checkPathIsDir(context.TODO(), testStatter, destPathInitial)
	require.NoError(tc.T, err, "bad path type")
	require.True(tc.T, isDestDir)
	require.Equal(tc.T, "/public/foobar", destPathString)

	destPath, err := makeDestPath(
		context.TODO(),
		tc.G,
		testStatter,
		path1,
		destPathInitial,
		true,
		"/public/foobar")
	assert.Equal(tc.T, filepath.ToSlash(filepath.Join("/public/foobar", filepath.Base(tempdir))), destPath.Kbfs().Path)
	assert.Equal(tc.T, err, ErrTargetFileExists, "Expected that remote target path exists because of SimpleFSMock")
	//	require.NoError(tc.T, err, "bad path type")

	pathType, err := destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_KBFS, pathType, "Expected remote path, got local")

	// Test when dest. does not exist.
	// Dest name should remain as-is in that case
	testStatter.localExists = false
	isDestDir, _, err = checkPathIsDir(context.TODO(), testStatter, destPath)
	require.NoError(tc.T, err, "bad path type")
	require.True(tc.T, isDestDir)

	destPath, err = makeDestPath(
		context.TODO(),
		tc.G,
		SimpleFSMock{},
		path1,
		destPathInitial,
		true,
		"/public/foobar")
	assert.Equal(tc.T, "/public/foobar", destPath.Kbfs().Path)
	require.NoError(tc.T, err, "bad path type")

	pathType, err = destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_KBFS, pathType, "Expected remote path, got local")

}

func TestSimpleFSRemoteSrcDir(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)
	defer tc.Cleanup()

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFStest")
	defer os.RemoveAll(tempdir)
	require.NoError(t, err)
	destPathInitial := keybase1.NewPathWithLocal(tempdir)
	require.NoError(t, err)
	testStatter := SimpleFSMock{remoteExists: true}

	srcPathInitial, err := makeSimpleFSPath("/keybase/public/foobar")
	require.NoError(tc.T, err)

	isSrcDir, srcPathString, err := checkPathIsDir(context.TODO(), testStatter, srcPathInitial)
	require.NoError(tc.T, err, "bad path type")
	require.True(tc.T, isSrcDir)
	require.Equal(tc.T, srcPathInitial.Kbfs().Path, srcPathString)

	// Test when dest. exists.
	// We append the last element of the source in that case.
	testStatter.localExists = true
	isDestDir, destPathString, err := checkPathIsDir(context.TODO(), testStatter, destPathInitial)
	require.NoError(tc.T, err, "bad path type")
	require.True(tc.T, isDestDir)
	require.Equal(tc.T, tempdir, destPathString)

	destPath, err := makeDestPath(
		context.TODO(),
		tc.G,
		testStatter,
		srcPathInitial,
		destPathInitial,
		true,
		tempdir)
	assert.Equal(tc.T, filepath.ToSlash(filepath.Join(tempdir, "foobar")), destPath.Local())
	require.NoError(tc.T, err, "Expected that remote target path does not exist")

	pathType, err := destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_LOCAL, pathType, "Expected local path, got remote")

	// Test when dest. does not exist by adding "foobar" on the end of the source.
	// Dest name should remain as-is in that case
	testStatter.localExists = false
	tempdir = filepath.Join(tempdir, "foobar")
	destPathInitial = keybase1.NewPathWithLocal(tempdir)
	_, destPathString, err = checkPathIsDir(context.TODO(), testStatter, destPathInitial)
	require.NoError(tc.T, err)
	assert.Equal(tc.T, tempdir, destPathString, "should use dest dir as-is")

	destPath, err = makeDestPath(
		context.TODO(),
		tc.G,
		testStatter,
		srcPathInitial,
		destPathInitial,
		true,
		tempdir)
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, tempdir, destPath.Local())

	pathType, err = destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_LOCAL, pathType, "Expected remote path, got local")

}

func TestSimpleFSLocalExists(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)
	defer tc.Cleanup()

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFstest")
	defer os.RemoveAll(tempdir)
	require.NoError(t, err)
	tempFile := filepath.Join(tempdir, "test1.txt")
	err = ioutil.WriteFile(tempFile, []byte("foo"), 0644)
	require.NoError(t, err)

	testPath, err := makeSimpleFSPath(tempdir)
	require.NoError(tc.T, err)
	pathType, err := testPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_LOCAL, pathType, "Expected local path, got remote")

	// check directory
	err = checkElementExists(context.TODO(), SimpleFSMock{}, testPath)
	require.Error(tc.T, err, "Should get an element exists error")

	// check file
	testPath, err = makeSimpleFSPath(tempFile)
	require.NoError(tc.T, err)
	err = checkElementExists(context.TODO(), SimpleFSMock{}, testPath)
	require.Error(tc.T, err, "Should get an element exists error")
}

func TestSimpleFSPlatformGlob(t *testing.T) {
	if runtime.GOOS != "windows" {
		return
	}
	tc := libkb.SetupTest(t, "simplefs_path", 0)
	defer tc.Cleanup()

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFstest")
	defer os.RemoveAll(tempdir)
	require.NoError(t, err)
	err = ioutil.WriteFile(filepath.Join(tempdir, "test1.txt"), []byte("foo"), 0644)
	require.NoError(t, err)
	err = ioutil.WriteFile(filepath.Join(tempdir, "test2.txt"), []byte("foo"), 0644)
	require.NoError(t, err)
	err = ioutil.WriteFile(filepath.Join(tempdir, "test3.txt"), []byte("foo"), 0644)
	require.NoError(t, err)
	path1 := keybase1.NewPathWithLocal(filepath.Join(tempdir, "*.txt"))

	paths, err := doSimpleFSGlob(context.TODO(), tc.G, SimpleFSMock{}, []keybase1.Path{path1})
	require.NoError(t, err)
	assert.Equal(tc.T, filepath.Join(tempdir, "test1.txt"), paths[0].Local())
	assert.Equal(tc.T, filepath.Join(tempdir, "test2.txt"), paths[1].Local())
	assert.Equal(tc.T, filepath.Join(tempdir, "test3.txt"), paths[2].Local())

	// mock some remote files
	mockResults := keybase1.SimpleFSListResult{
		Entries: []keybase1.Dirent{
			{Name: "test1.txt"},
			{Name: "test2.txt"},
			{Name: "test3.txt"},
		},
	}
	clientMock := SimpleFSMock{
		ListResult: &mockResults,
	}
	path1 = keybase1.NewPathWithKbfsPath("/private/foobar/temp/*.txt")

	paths, err = doSimpleFSGlob(context.TODO(), tc.G, clientMock, []keybase1.Path{path1})
	require.NoError(t, err)
	assert.Equal(tc.T, "/private/foobar/temp/test1.txt", paths[0].Kbfs().Path)
	assert.Equal(tc.T, "/private/foobar/temp/test2.txt", paths[1].Kbfs().Path)
	assert.Equal(tc.T, "/private/foobar/temp/test3.txt", paths[2].Kbfs().Path)

}

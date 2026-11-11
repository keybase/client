// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package simplefs

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// waitForUploadsDone polls on the test goroutine so a failed upload is
// reported (with its error text) as soon as it shows up.
func waitForUploadsDone(ctx context.Context, t *testing.T, sfs *SimpleFS) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for {
		uploads, err := sfs.SimpleFSGetUploadStatus(ctx)
		require.NoError(t, err)
		for _, u := range uploads {
			if u.Error != nil {
				require.Failf(t, "upload failed", "upload to %s: %s",
					u.TargetPath.Path, *u.Error)
			}
			require.False(t, u.Canceled, "upload to %s was canceled",
				u.TargetPath.Path)
		}
		if len(uploads) == 0 {
			return
		}
		if time.Now().After(deadline) {
			require.Failf(t, "uploads never finished", "%+v", uploads)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// stageSharedTempDir stages a.txt and b.txt into one temp dir from
// SimpleFSMakeTempDirForUpload, the way the desktop drag-and-drop does.
func stageSharedTempDir(ctx context.Context, t *testing.T) (
	sfs *SimpleFS, tempDir, fileA, fileB string,
) {
	sfs = newSimpleFS(env.EmptyAppStateUpdater{}, libkbfs.MakeTestConfigOrBust(t, "jdoe"))
	t.Cleanup(func() { closeSimpleFS(ctx, t, sfs) })

	cacheDir, err := os.MkdirTemp(TempDirBase, "simplefs-uploadtest-cache")
	require.NoError(t, err)
	t.Cleanup(func() { _ = os.RemoveAll(cacheDir) })
	sfs.getUploadManager().cacheDir = cacheDir

	tempDir, err = sfs.SimpleFSMakeTempDirForUpload(ctx)
	require.NoError(t, err)
	fileA = filepath.Join(tempDir, "a.txt")
	fileB = filepath.Join(tempDir, "b.txt")
	require.NoError(t, os.WriteFile(fileA, []byte("aaa"), 0o600))
	require.NoError(t, os.WriteFile(fileB, []byte("bbb"), 0o600))
	return sfs, tempDir, fileA, fileB
}

func startUpload(ctx context.Context, t *testing.T, sfs *SimpleFS,
	source string, target keybase1.KBFSPath,
) {
	_, err := sfs.SimpleFSStartUpload(ctx, keybase1.SimpleFSStartUploadArg{
		SourceLocalPath:  source,
		TargetParentPath: target,
	})
	require.NoError(t, err)
}

// requireUploadedAndCleanedUp checks both files landed in KBFS and that the
// shared temp dir is gone once nothing uploads from it any more.
func requireUploadedAndCleanedUp(ctx context.Context, t *testing.T,
	sfs *SimpleFS, target keybase1.KBFSPath, tempDir string,
) {
	remote := keybase1.NewPathWithKbfsPath(target.Path)
	require.Equal(t, "aaa", string(readRemoteFile(ctx, t, sfs, pathAppend(remote, "a.txt"))))
	require.Equal(t, "bbb", string(readRemoteFile(ctx, t, sfs, pathAppend(remote, "b.txt"))))

	require.Eventually(t, func() bool {
		_, err := os.Stat(tempDir)
		return os.IsNotExist(err)
	}, 3*time.Second, 10*time.Millisecond,
		"shared temp dir %s left behind after every upload from it finished", tempDir)
}

// Several files dropped at once are staged into one temp dir, then uploaded
// one by one. Finishing one upload must not delete the files the others
// still need.
func TestUploadSharedTempDirMultipleFiles(t *testing.T) {
	ctx := context.Background()
	sfs, tempDir, fileA, fileB := stageSharedTempDir(ctx, t)
	target := keybase1.KBFSPath{Path: "/private/jdoe"}

	startUpload(ctx, t, sfs, fileA, target)
	waitForUploadsDone(ctx, t, sfs)

	// The temp dir cleanup runs right after the upload leaves the status
	// list, so give it a moment to land before checking.
	require.Never(t, func() bool {
		_, err := os.Stat(fileB)
		return err != nil
	}, time.Second, 10*time.Millisecond,
		"finishing the first upload removed the second file from the shared temp dir")

	startUpload(ctx, t, sfs, fileB, target)
	waitForUploadsDone(ctx, t, sfs)

	requireUploadedAndCleanedUp(ctx, t, sfs, target, tempDir)
}

// Same as above, but the uploads start back to back before either is waited
// on, like the desktop drag-and-drop does. The second item is a folder, so
// its copy is still reading from the temp dir when the small first upload
// finishes.
func TestUploadSharedTempDirMultipleFilesConcurrent(t *testing.T) {
	ctx := context.Background()
	sfs, tempDir, fileA, fileB := stageSharedTempDir(ctx, t)
	target := keybase1.KBFSPath{Path: "/private/jdoe"}

	const folderFiles = 100
	folder := filepath.Join(tempDir, "folder")
	require.NoError(t, os.Mkdir(folder, 0o700))
	for i := range folderFiles {
		name := filepath.Join(folder, fmt.Sprintf("f%03d.txt", i))
		require.NoError(t, os.WriteFile(name, []byte(name), 0o600))
	}

	startUpload(ctx, t, sfs, fileA, target)
	startUpload(ctx, t, sfs, folder, target)
	startUpload(ctx, t, sfs, fileB, target)
	waitForUploadsDone(ctx, t, sfs)

	remote := keybase1.NewPathWithKbfsPath(target.Path)
	for i := range folderFiles {
		name := fmt.Sprintf("f%03d.txt", i)
		require.Equal(t, filepath.Join(folder, name), string(readRemoteFile(
			ctx, t, sfs, pathAppend(pathAppend(remote, "folder"), name))))
	}
	requireUploadedAndCleanedUp(ctx, t, sfs, target, tempDir)
}

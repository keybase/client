// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package simplefs

import (
	"fmt"

	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestDownloadManager(t *testing.T) {
	ctx := context.Background()
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	sfs := newSimpleFS(env.EmptyAppStateUpdater{}, config)
	defer closeSimpleFS(ctx, t, sfs)

	t.Log("Write a file in the shared directory")
	pathPriv := keybase1.NewPathWithKbfsPath(`/private/jdoe`)
	writeRemoteFile(
		ctx, t, sfs, pathAppend(pathPriv, `test.txt`), []byte(`foo`))
	syncFS(ctx, t, sfs, "/private/jdoe")

	cacheDir, err := os.MkdirTemp(TempDirBase, "simplefs-downloadtest-cache")
	require.NoError(t, err)
	defer os.RemoveAll(cacheDir)
	downloadDir, err := os.MkdirTemp(TempDirBase, "simplefs-downloadtest-download")
	require.NoError(t, err)
	defer os.RemoveAll(downloadDir)

	err = sfs.SimpleFSConfigureDownload(ctx, keybase1.SimpleFSConfigureDownloadArg{
		CacheDirOverride:    cacheDir,
		DownloadDirOverride: downloadDir,
	})
	require.NoError(t, err)

	testDownload := func(isRegularDownload bool, regularDownloadIndex int) {
		downloadID, err := sfs.SimpleFSStartDownload(ctx, keybase1.SimpleFSStartDownloadArg{
			Path:              keybase1.KBFSPath{Path: "/private/jdoe/test.txt"},
			IsRegularDownload: isRegularDownload,
		})
		require.NoError(t, err)
		status, err := sfs.SimpleFSGetDownloadStatus(ctx)
		require.NoError(t, err)
		require.Len(t, status.States, 1)
		require.Equal(t, downloadID, status.States[0].DownloadID)
		if isRegularDownload {
			require.Len(t, status.RegularDownloadIDs, 1)
			require.Equal(t, downloadID, status.RegularDownloadIDs[0])
		} else {
			require.Empty(t, status.RegularDownloadIDs)
		}
		info, err := sfs.SimpleFSGetDownloadInfo(ctx, downloadID)
		require.NoError(t, err)
		require.Equal(t, isRegularDownload, info.IsRegularDownload)
		require.Equal(t, "/private/jdoe/test.txt", info.Path.Path)
		require.Equal(t, "test.txt", info.Filename)
		for i := 0; !status.States[0].Done; i++ {
			if i > 10 {
				t.Fatalf("waiting on download to finish timeout")
			}
			status, err = sfs.SimpleFSGetDownloadStatus(ctx)
			require.NoError(t, err)
			time.Sleep(time.Second / 2)
		}
		if isRegularDownload {
			if regularDownloadIndex == 0 {
				require.Equal(t, filepath.Join(downloadDir, "test.txt"), status.States[0].LocalPath)
			} else {
				require.Equal(t, filepath.Join(downloadDir, fmt.Sprintf("test (%d).txt", regularDownloadIndex)), status.States[0].LocalPath)
			}
		} else {
			lpath := filepath.Clean(status.States[0].LocalPath)
			require.True(t, strings.HasPrefix(lpath, filepath.Clean(cacheDir)))
			require.True(t, strings.HasSuffix(lpath, ".txt"))
		}
		err = sfs.SimpleFSDismissDownload(ctx, downloadID)
		require.NoError(t, err)
	}
	testDownload(true, 0)
	testDownload(true, 1)
	testDownload(false, 0)
}

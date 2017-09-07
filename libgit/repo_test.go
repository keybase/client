// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"io/ioutil"
	"os"
	"testing"

	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

func initConfig(t *testing.T) (
	ctx context.Context, config *libkbfs.ConfigLocal, tempDir string) {
	ctx = libkbfs.BackgroundContextWithCancellationDelayer()
	config = libkbfs.MakeTestConfigOrBustLoggedInWithMode(
		t, 0, libkbfs.InitSingleOp, "user1")
	success := false

	var err error
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_server")
	require.NoError(t, err)
	defer func() {
		if !success {
			os.RemoveAll(tempdir)
		}
	}()

	err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config.EnableJournaling(
		ctx, tempdir, libkbfs.TLFJournalBackgroundWorkEnabled)
	require.NoError(t, err)

	return ctx, config, tempDir
}

func TestRepo(t *testing.T) {
	ctx, config, tempdir := initConfig(t)
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)

	fs, id1, err := GetOrCreateRepoAndID(ctx, config, h, "Repo1", "")
	require.NoError(t, err)

	// Another get should have the same ID.
	_, id2, err := GetOrCreateRepoAndID(ctx, config, h, "Repo1", "")
	require.NoError(t, err)
	require.Equal(t, id1, id2)

	// Now make sure case doesn't matter.
	_, id3, err := GetOrCreateRepoAndID(ctx, config, h, "repo1", "")
	require.NoError(t, err)
	require.Equal(t, id1, id3)

	// A one letter repo name is ok.
	_, _, err = GetOrCreateRepoAndID(ctx, config, h, "r", "")
	require.NoError(t, err)

	// Invalid names.
	_, _, err = GetOrCreateRepoAndID(ctx, config, h, ".repo2", "")
	require.NotNil(t, err)
	_, _, err = GetOrCreateRepoAndID(ctx, config, h, "repo3.ツ", "")
	require.NotNil(t, err)
	_, _, err = GetOrCreateRepoAndID(ctx, config, h, "repo(4)", "")
	require.NotNil(t, err)

	fs.SyncAll()

	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	jServer, err := libkbfs.GetJournalServer(config)
	require.NoError(t, err)
	err = jServer.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf)
	require.NoError(t, err)
}

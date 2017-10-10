// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"io/ioutil"
	"os"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
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

func TestGetOrCreateRepoAndID(t *testing.T) {
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

	// A trailing ".git" should be ignored.
	_, id4, err := GetOrCreateRepoAndID(ctx, config, h, "repo1.git", "")
	require.NoError(t, err)
	require.Equal(t, id1, id4)

	// A one letter repo name is ok.
	_, id5, err := GetOrCreateRepoAndID(ctx, config, h, "r", "")
	require.NoError(t, err)
	require.NotEqual(t, id1, id5)

	// Invalid names.
	_, _, err = GetOrCreateRepoAndID(ctx, config, h, "", "")
	require.IsType(t, libkb.InvalidRepoNameError{}, errors.Cause(err))
	_, _, err = GetOrCreateRepoAndID(ctx, config, h, ".repo2", "")
	require.IsType(t, libkb.InvalidRepoNameError{}, errors.Cause(err))
	_, _, err = GetOrCreateRepoAndID(ctx, config, h, "repo3.ツ", "")
	require.IsType(t, libkb.InvalidRepoNameError{}, errors.Cause(err))
	_, _, err = GetOrCreateRepoAndID(ctx, config, h, "repo(4)", "")
	require.IsType(t, libkb.InvalidRepoNameError{}, errors.Cause(err))

	fs.SyncAll()

	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	jServer, err := libkbfs.GetJournalServer(config)
	require.NoError(t, err)
	err = jServer.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf, nil)
	require.NoError(t, err)
}

func TestCreateRepoAndID(t *testing.T) {
	ctx, config, tempdir := initConfig(t)
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)

	id1, err := CreateRepoAndID(ctx, config, h, "Repo1")
	require.NoError(t, err)

	id2, err := CreateRepoAndID(ctx, config, h, "Repo2")
	require.NoError(t, err)
	require.NotEqual(t, id1, id2)

	_, err = CreateRepoAndID(ctx, config, h, "Repo1")
	require.IsType(t, libkb.RepoAlreadyExistsError{}, err)

	_, err = CreateRepoAndID(ctx, config, h, "rePo1")
	require.IsType(t, libkb.RepoAlreadyExistsError{}, err)

	_, err = CreateRepoAndID(ctx, config, h, "repo2")
	require.IsType(t, libkb.RepoAlreadyExistsError{}, err)

	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	jServer, err := libkbfs.GetJournalServer(config)
	require.NoError(t, err)
	err = jServer.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf, nil)
	require.NoError(t, err)
}

func TestGetRepoAndID(t *testing.T) {
	ctx, config, tempdir := initConfig(t)
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)

	_, _, err = GetRepoAndID(ctx, config, h, "Repo1", "")
	require.IsType(t, NoSuchRepoError{}, errors.Cause(err))

	id1, err := CreateRepoAndID(ctx, config, h, "Repo1")
	require.NoError(t, err)

	_, id2, err := GetRepoAndID(ctx, config, h, "Repo1", "")
	require.NoError(t, err)
	require.Equal(t, id1, id2)

	_, id3, err := GetRepoAndID(ctx, config, h, "repo1", "")
	require.NoError(t, err)
	require.Equal(t, id1, id3)

	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	jServer, err := libkbfs.GetJournalServer(config)
	require.NoError(t, err)
	err = jServer.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf, nil)
	require.NoError(t, err)
}

func TestDeleteRepo(t *testing.T) {
	ctx, config, tempdir := initConfig(t)
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	clock := &libkbfs.TestClock{}
	clock.Set(time.Now())
	config.SetClock(clock)

	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)

	_, err = CreateRepoAndID(ctx, config, h, "Repo1")
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	jServer, err := libkbfs.GetJournalServer(config)
	require.NoError(t, err)
	err = jServer.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf, nil)
	require.NoError(t, err)

	err = DeleteRepo(ctx, config, h, "Repo1")
	require.NoError(t, err)

	gitNode, _, err := config.KBFSOps().Lookup(ctx, rootNode, kbfsRepoDir)
	require.NoError(t, err)
	children, err := config.KBFSOps().GetDirChildren(ctx, gitNode)
	require.NoError(t, err)
	require.Len(t, children, 1)
	require.Contains(t, children, kbfsDeletedReposDir)

	deletedReposNode, _, err := config.KBFSOps().Lookup(
		ctx, gitNode, kbfsDeletedReposDir)
	require.NoError(t, err)
	children, err = config.KBFSOps().GetDirChildren(ctx, deletedReposNode)
	require.NoError(t, err)
	require.Len(t, children, 1)

	// If cleanup happens too soon, it shouldn't clean the repo.
	err = CleanOldDeletedRepos(ctx, config, h)
	require.NoError(t, err)
	children, err = config.KBFSOps().GetDirChildren(ctx, deletedReposNode)
	require.NoError(t, err)
	require.Len(t, children, 1)

	// After a long time, cleanup should succeed.
	clock.Add(minDeletedAgeForCleaning)
	err = CleanOldDeletedRepos(ctx, config, h)
	require.NoError(t, err)
	children, err = config.KBFSOps().GetDirChildren(ctx, deletedReposNode)
	require.NoError(t, err)
	require.Len(t, children, 0)

	err = jServer.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf, nil)
	require.NoError(t, err)
}

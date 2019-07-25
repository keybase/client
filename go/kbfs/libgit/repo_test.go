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

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

func initConfig(t *testing.T) (
	ctx context.Context, cancel context.CancelFunc,
	config *libkbfs.ConfigLocal, tempdir string) {
	ctx = libcontext.BackgroundContextWithCancellationDelayer()
	config = libkbfs.MakeTestConfigOrBustLoggedInWithMode(
		t, 0, libkbfs.InitSingleOp, "user1", "user2")
	success := false
	ctx = context.WithValue(ctx, libkbfs.CtxAllowNameKey, kbfsRepoDir)

	ctx, cancel = context.WithTimeout(ctx, 10*time.Second)

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

	return ctx, cancel, config, tempdir
}

func TestGetOrCreateRepoAndID(t *testing.T) {
	ctx, cancel, config, tempdir := initConfig(t)
	defer cancel()
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "user1", tlf.Private)
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

	err = fs.SyncAll()
	require.NoError(t, err)

	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, data.MasterBranch)
	require.NoError(t, err)
	jManager, err := libkbfs.GetJournalManager(config)
	require.NoError(t, err)
	err = jManager.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf,
		nil, keybase1.MDPriorityGit)
	require.NoError(t, err)
}

func TestCreateRepoAndID(t *testing.T) {
	ctx, cancel, config, tempdir := initConfig(t)
	defer cancel()
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "user1", tlf.Private)
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
		ctx, h, data.MasterBranch)
	require.NoError(t, err)
	jManager, err := libkbfs.GetJournalManager(config)
	require.NoError(t, err)
	err = jManager.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf,
		nil, keybase1.MDPriorityGit)
	require.NoError(t, err)
}

func TestCreateDuplicateRepo(t *testing.T) {
	ctx, cancel, config, tempdir := initConfig(t)
	defer cancel()
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	config2 := libkbfs.ConfigAsUser(config, "user2")
	ctx2, cancel2 := context.WithCancel(context.Background())
	defer cancel2()
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_server")
	require.NoError(t, err)
	defer os.RemoveAll(tempdir)
	err = config2.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config2.EnableJournaling(
		ctx2, tempdir, libkbfs.TLFJournalSingleOpBackgroundWorkEnabled)
	require.NoError(t, err)
	defer libkbfs.CheckConfigAndShutdown(ctx2, t, config2)

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "user1,user2", tlf.Private)
	require.NoError(t, err)

	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, data.MasterBranch)
	require.NoError(t, err)

	t.Log("Start one create and wait for it to get the lock")
	onStalled, unstall, getCtx := libkbfs.StallMDOp(
		ctx, config, libkbfs.StallableMDAfterGetRange, 1)
	err1ch := make(chan error, 1)
	go func() {
		_, err := CreateRepoAndID(getCtx, config, h, "Repo1")
		err1ch <- err
	}()

	select {
	case <-onStalled:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	t.Log("Start 2nd create and wait for it to try to get the lock")
	_, _, err = config2.KBFSOps().GetOrCreateRootNode(
		ctx2, h, data.MasterBranch)
	require.NoError(t, err)
	onStalled2, unstall2, getCtx2 := libkbfs.StallMDOp(
		ctx2, config2, libkbfs.StallableMDGetRange, 1)
	err2ch := make(chan error, 1)
	go func() {
		_, err := CreateRepoAndID(getCtx2, config2, h, "Repo1")
		err2ch <- err
	}()

	select {
	case <-onStalled2:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	close(unstall)
	select {
	case err := <-err1ch:
		require.NoError(t, err)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	close(unstall2)
	select {
	case err := <-err2ch:
		require.IsType(t, libkb.RepoAlreadyExistsError{}, errors.Cause(err))
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	jManager, err := libkbfs.GetJournalManager(config)
	require.NoError(t, err)
	err = jManager.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf,
		nil, keybase1.MDPriorityGit)
	require.NoError(t, err)
}

func TestGetRepoAndID(t *testing.T) {
	ctx, cancel, config, tempdir := initConfig(t)
	defer cancel()
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "user1", tlf.Private)
	require.NoError(t, err)

	_, _, err = GetRepoAndID(ctx, config, h, "Repo1", "")
	require.IsType(t, libkb.RepoDoesntExistError{}, errors.Cause(err))

	id1, err := CreateRepoAndID(ctx, config, h, "Repo1")
	require.NoError(t, err)

	_, id2, err := GetRepoAndID(ctx, config, h, "Repo1", "")
	require.NoError(t, err)
	require.Equal(t, id1, id2)

	_, id3, err := GetRepoAndID(ctx, config, h, "repo1", "")
	require.NoError(t, err)
	require.Equal(t, id1, id3)

	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, data.MasterBranch)
	require.NoError(t, err)
	jManager, err := libkbfs.GetJournalManager(config)
	require.NoError(t, err)
	err = jManager.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf,
		nil, keybase1.MDPriorityGit)
	require.NoError(t, err)
}

func TestDeleteRepo(t *testing.T) {
	ctx, cancel, config, tempdir := initConfig(t)
	defer cancel()
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	clock := &clocktest.TestClock{}
	clock.Set(time.Now())
	config.SetClock(clock)

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "user1", tlf.Private)
	require.NoError(t, err)

	_, err = CreateRepoAndID(ctx, config, h, "Repo1")
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, data.MasterBranch)
	require.NoError(t, err)
	jManager, err := libkbfs.GetJournalManager(config)
	require.NoError(t, err)
	err = jManager.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf,
		nil, keybase1.MDPriorityGit)
	require.NoError(t, err)

	err = DeleteRepo(ctx, config, h, "Repo1")
	require.NoError(t, err)

	gitNode, _, err := config.KBFSOps().Lookup(
		ctx, rootNode, rootNode.ChildName(kbfsRepoDir))
	require.NoError(t, err)
	children, err := config.KBFSOps().GetDirChildren(ctx, gitNode)
	require.NoError(t, err)
	require.Len(t, children, 0) // .kbfs_deleted_repos is hidden

	deletedReposNode, _, err := config.KBFSOps().Lookup(
		ctx, gitNode, gitNode.ChildName(kbfsDeletedReposDir))
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

	err = jManager.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf,
		nil, keybase1.MDPriorityGit)
	require.NoError(t, err)
}

func TestRepoRename(t *testing.T) {
	ctx, cancel, config, tempdir := initConfig(t)
	defer cancel()
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "user1", tlf.Private)
	require.NoError(t, err)

	id1, err := CreateRepoAndID(ctx, config, h, "Repo1")
	require.NoError(t, err)

	err = RenameRepo(ctx, config, h, "Repo1", "Repo2")
	require.NoError(t, err)

	_, id2, err := GetRepoAndID(ctx, config, h, "Repo2", "")
	require.NoError(t, err)
	require.Equal(t, id1, id2)

	_, id3, err := GetRepoAndID(ctx, config, h, "Repo1", "")
	require.NoError(t, err)
	require.Equal(t, id1, id3)

	// Test a same-name repo rename.
	err = RenameRepo(ctx, config, h, "Repo2", "repo2")
	require.NoError(t, err)

	_, id4, err := GetRepoAndID(ctx, config, h, "repo2", "")
	require.NoError(t, err)
	require.Equal(t, id1, id4)

	// Can't rename onto existing repo.
	id5, err := CreateRepoAndID(ctx, config, h, "Repo3")
	require.NoError(t, err)
	err = RenameRepo(ctx, config, h, "Repo2", "repo3")
	require.IsType(t, libkb.RepoAlreadyExistsError{}, errors.Cause(err))

	// Invalid new repo name.
	err = RenameRepo(ctx, config, h, "Repo3", "")
	require.IsType(t, libkb.InvalidRepoNameError{}, errors.Cause(err))

	// Can create a new repo over the old symlink.
	id6, err := CreateRepoAndID(ctx, config, h, "Repo1")
	require.NoError(t, err)
	require.NotEqual(t, id1, id6)

	// Can rename onto a symlink.
	err = RenameRepo(ctx, config, h, "repo2", "repo4")
	require.NoError(t, err)
	err = RenameRepo(ctx, config, h, "repo3", "repo2")
	require.NoError(t, err)
	_, id7, err := GetRepoAndID(ctx, config, h, "repo2", "")
	require.NoError(t, err)
	require.Equal(t, id5, id7)
}

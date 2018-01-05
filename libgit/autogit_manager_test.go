// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"io"
	"io/ioutil"
	"os"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	billy "gopkg.in/src-d/go-billy.v4"
	gogit "gopkg.in/src-d/go-git.v4"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
)

func initConfigForAutogit(t *testing.T) (
	ctx context.Context, config *libkbfs.ConfigLocal,
	cancel context.CancelFunc, tempdir string) {
	ctx = libkbfs.BackgroundContextWithCancellationDelayer()
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
		ctx, tempdir, libkbfs.TLFJournalSingleOpBackgroundWorkEnabled)
	require.NoError(t, err)

	success = true
	return ctx, config, cancel, tempdir
}

// configNoShutdown shields a config from being shutdown, to prevent
// test mdservers from being shut down in the middle of a test.
type configNoShutdown struct {
	libkbfs.Config
}

// Shutdown implements the libkbfs.Config interface for configNoShutdown.
func (c *configNoShutdown) Shutdown(_ context.Context) error {
	// Ignore.
	return nil
}

// newConfigger constructs a new test config that shares the same test
// server implementations as the given `config`.
type newConfigger struct {
	config    *libkbfs.ConfigLocal
	user      libkb.NormalizedUsername
	newConfig *libkbfs.ConfigLocal
}

func (nc *newConfigger) shutdown(t *testing.T, ctx context.Context) {
	if nc.newConfig != nil {
		libkbfs.CheckConfigAndShutdown(ctx, t, nc.newConfig)
	}
}

func (nc *newConfigger) getNewConfigForTest(ctx context.Context) (
	newCtx context.Context, gitConfig libkbfs.Config,
	tempDir string, err error) {
	ctx, err = libkbfs.NewContextWithCancellationDelayer(ctx)
	if err != nil {
		return nil, nil, "", err
	}
	config := libkbfs.ConfigAsUser(nc.config, nc.user)
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_server")
	if err != nil {
		return nil, nil, "", err
	}
	err = config.EnableDiskLimiter(tempdir)
	if err != nil {
		return nil, nil, "", err
	}
	err = config.EnableJournaling(
		ctx, tempdir, libkbfs.TLFJournalSingleOpBackgroundWorkEnabled)
	if err != nil {
		return nil, nil, "", err
	}
	nc.newConfig = config
	return ctx, &configNoShutdown{config}, tempdir, nil
}

func addFileToWorktreeAndCommit(
	t *testing.T, ctx context.Context, config libkbfs.Config,
	h *libkbfs.TlfHandle, repo *gogit.Repository, worktreeFS billy.Filesystem,
	name, data string) {
	foo, err := worktreeFS.Create(name)
	require.NoError(t, err)
	defer foo.Close()
	_, err = io.WriteString(foo, data)
	require.NoError(t, err)
	wt, err := repo.Worktree()
	require.NoError(t, err)
	_, err = wt.Add(name)
	require.NoError(t, err)
	_, err = wt.Commit("foo commit", &gogit.CommitOptions{
		Author: &object.Signature{
			Name:  "me",
			Email: "me@keyba.se",
			When:  time.Now(),
		},
	})
	require.NoError(t, err)

	err = worktreeFS.(*libfs.FS).SyncAll()
	require.NoError(t, err)
	jServer, err := libkbfs.GetJournalServer(config)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	err = jServer.FinishSingleOp(ctx,
		rootNode.GetFolderBranch().Tlf, nil, keybase1.MDPriorityNormal)
	require.NoError(t, err)
}

func checkFileInRootFS(
	t *testing.T, ctx context.Context, config libkbfs.Config,
	h *libkbfs.TlfHandle, rootFS billy.Filesystem, name, expectedData string) {
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)
	err = config.KBFSOps().SyncFromServerForTesting(
		ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	f, err := rootFS.Open(name)
	require.NoError(t, err)
	defer f.Close()
	data, err := ioutil.ReadAll(f)
	require.NoError(t, err)
	require.Equal(t, expectedData, string(data))
}

func TestAutogitManager(t *testing.T) {
	ctx, config, cancel, tempdir := initConfigForAutogit(t)
	defer cancel()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	h, err := libkbfs.ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "user1", tlf.Private)
	require.NoError(t, err)
	rootFS, err := libfs.NewFS(
		ctx, config, h, "", "", keybase1.MDPriorityNormal)
	require.NoError(t, err)

	t.Log("Init a new repo directly into KBFS.")
	dotgitFS, _, err := GetOrCreateRepoAndID(ctx, config, h, "test", "")
	require.NoError(t, err)
	err = rootFS.MkdirAll("worktree", 0600)
	require.NoError(t, err)
	worktreeFS, err := rootFS.Chroot("worktree")
	require.NoError(t, err)
	dotgitStorage, err := NewGitConfigWithoutRemotesStorer(dotgitFS)
	require.NoError(t, err)
	repo, err := gogit.Init(dotgitStorage, worktreeFS)
	require.NoError(t, err)
	addFileToWorktreeAndCommit(
		t, ctx, config, h, repo, worktreeFS, "foo", "hello")

	kbCtx := env.NewContext()
	kbfsInitParams := libkbfs.DefaultInitParams(kbCtx)
	am := NewAutogitManager(config, kbCtx, &kbfsInitParams, 1)
	defer am.Shutdown()
	nc := &newConfigger{config: config, user: "user1"}
	defer nc.shutdown(t, ctx)
	am.getNewConfig = nc.getNewConfigForTest

	err = rootFS.MkdirAll("checkout", 0600)

	doneCh, err := am.Clone(ctx, h, "test", "master", h, "checkout")
	require.NoError(t, err)
	select {
	case <-doneCh:
	case <-ctx.Done():
		t.Fatal(ctx.Err().Error())
	}

	checkFileInRootFS(t, ctx, config, h, rootFS, "checkout/test/foo", "hello")

	t.Log("Add a new file and try a pull.")
	addFileToWorktreeAndCommit(
		t, ctx, config, h, repo, worktreeFS, "foo2", "hello2")
	doneCh, err = am.Pull(ctx, h, "test", "master", h, "checkout")
	require.NoError(t, err)
	select {
	case <-doneCh:
	case <-ctx.Done():
		t.Fatal(ctx.Err().Error())
	}

	checkFileInRootFS(t, ctx, config, h, rootFS, "checkout/test/foo2", "hello2")
}

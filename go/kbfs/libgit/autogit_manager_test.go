// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"io"
	"os"
	"testing"
	"time"

	billy "github.com/go-git/go-billy/v5"
	gogit "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func initConfigForAutogit(t *testing.T) (
	ctx context.Context, config *libkbfs.ConfigLocal,
	cancel context.CancelFunc, tempdir string,
) {
	ctx = libcontext.BackgroundContextWithCancellationDelayer()
	config = libkbfs.MakeTestConfigOrBustLoggedInWithMode(
		t, 0, libkbfs.InitDefault, "user1", "user2")
	success := false
	ctx = context.WithValue(ctx, libkbfs.CtxAllowNameKey, kbfsRepoDir)

	ctx, cancel = context.WithTimeout(ctx, 2*time.Minute)

	tempdir, err := os.MkdirTemp(os.TempDir(), "journal_server")
	require.NoError(t, err)
	defer func() {
		if !success {
			_ = os.RemoveAll(tempdir)
		}
	}()

	err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config.EnableJournaling(
		ctx, tempdir, libkbfs.TLFJournalBackgroundWorkEnabled)
	require.NoError(t, err)

	success = true
	return ctx, config, cancel, tempdir
}

func addFileToWorktreeWithInfo(
	t *testing.T, repo *gogit.Repository, worktreeFS billy.Filesystem,
	name, data, msg, userName, userEmail string, timestamp time.Time) (
	hash plumbing.Hash,
) {
	foo, err := worktreeFS.Create(name)
	require.NoError(t, err)
	defer func() { _ = foo.Close() }()
	_, err = io.WriteString(foo, data)
	require.NoError(t, err)
	wt, err := repo.Worktree()
	require.NoError(t, err)
	_, err = wt.Add(name)
	require.NoError(t, err)
	hash, err = wt.Commit(msg, &gogit.CommitOptions{
		Author: &object.Signature{
			Name:  userName,
			Email: userEmail,
			When:  timestamp,
		},
	})
	require.NoError(t, err)
	return hash
}

func addFileToWorktree(
	t *testing.T, repo *gogit.Repository, worktreeFS billy.Filesystem,
	name, data string,
) {
	_ = addFileToWorktreeWithInfo(
		t, repo, worktreeFS, name, data, "foo commit", "me", "me@keyba.se",
		time.Now())
}

func addFileToWorktreeAndCommit(
	ctx context.Context, t *testing.T, config libkbfs.Config,
	h *tlfhandle.Handle, repo *gogit.Repository, worktreeFS billy.Filesystem,
	name, data string,
) {
	addFileToWorktree(t, repo, worktreeFS, name, data)
	commitWorktree(ctx, t, config, h, worktreeFS)
}

func commitWorktree(
	ctx context.Context, t *testing.T, config libkbfs.Config,
	h *tlfhandle.Handle, worktreeFS billy.Filesystem,
) {
	err := worktreeFS.(*libfs.FS).SyncAll()
	require.NoError(t, err)
	jManager, err := libkbfs.GetJournalManager(config)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, data.MasterBranch)
	require.NoError(t, err)
	err = jManager.FinishSingleOp(ctx,
		rootNode.GetFolderBranch().Tlf, nil, keybase1.MDPriorityNormal)
	require.NoError(t, err)
}

// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"fmt"
	"io/ioutil"
	"os"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	gogit "gopkg.in/src-d/go-git.v4"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
)

func TestAutogitNodeWrappersNoRepos(t *testing.T) {
	ctx, config, cancel, tempdir := initConfigForAutogit(t)
	defer cancel()
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	shutdown := StartAutogit(config, 25)
	defer shutdown()

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "user1", tlf.Private)
	require.NoError(t, err)
	rootFS, err := libfs.NewFS(
		ctx, config, h, data.MasterBranch, "", "", keybase1.MDPriorityNormal)
	require.NoError(t, err)

	t.Log("Looking at user1's autogit directory should fail if no git repos")
	_, err = rootFS.ReadDir(AutogitRoot)
	require.Error(t, err)
}

func checkAutogitOneFile(t *testing.T, rootFS *libfs.FS) {
	fis, err := rootFS.ReadDir(".kbfs_autogit/test")
	require.NoError(t, err)
	require.Len(t, fis, 1)
	f, err := rootFS.Open(".kbfs_autogit/test/foo")
	require.NoError(t, err)
	defer f.Close()
	data, err := ioutil.ReadAll(f)
	require.NoError(t, err)
	require.Equal(t, "hello", string(data))
}

func checkAutogitTwoFiles(t *testing.T, rootFS *libfs.FS) {
	fis, err := rootFS.ReadDir(".kbfs_autogit/test")
	require.NoError(t, err)
	require.Len(t, fis, 2) // foo and foo2
	f, err := rootFS.Open(".kbfs_autogit/test/foo")
	require.NoError(t, err)
	defer f.Close()
	data, err := ioutil.ReadAll(f)
	require.NoError(t, err)
	require.Equal(t, "hello", string(data))
	f2, err := rootFS.Open(".kbfs_autogit/test/foo2")
	require.NoError(t, err)
	defer f2.Close()
	data2, err := ioutil.ReadAll(f2)
	require.NoError(t, err)
	require.Equal(t, "hello2", string(data2))
	// Make sure a non-existent file gives the right error.
	_, err = rootFS.Open(".kbfs_autogit/test/missing")
	require.True(t, os.IsNotExist(errors.Cause(err)))
}

func TestAutogitRepoNode(t *testing.T) {
	ctx, config, cancel, tempdir := initConfigForAutogit(t)
	defer cancel()
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	am := NewAutogitManager(config, 25)
	defer am.Shutdown()
	rw := rootWrapper{am}
	config.AddRootNodeWrapper(rw.wrap)

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "user1", tlf.Private)
	require.NoError(t, err)
	rootFS, err := libfs.NewFS(
		ctx, config, h, data.MasterBranch, "", "", keybase1.MDPriorityNormal)
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
		ctx, t, config, h, repo, worktreeFS, "foo", "hello")

	t.Log("Use autogit to clone it using ReadDir")
	checkAutogitOneFile(t, rootFS)

	t.Log("Update the source repo and make sure the autogit repos update too")
	addFileToWorktreeAndCommit(
		ctx, t, config, h, repo, worktreeFS, "foo2", "hello2")

	t.Log("Force the source repo to update for the user")
	srcRootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, data.MasterBranch)
	require.NoError(t, err)
	err = config.KBFSOps().SyncFromServer(
		ctx, srcRootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	t.Log("Update the dest repo")
	dstRootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, data.MasterBranch)
	require.NoError(t, err)
	err = config.KBFSOps().SyncFromServer(
		ctx, dstRootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	checkAutogitTwoFiles(t, rootFS)

	t.Log("Switch to branch, check in more files.")
	wt, err := repo.Worktree()
	require.NoError(t, err)
	err = wt.Checkout(&gogit.CheckoutOptions{
		Branch: "refs/heads/dir/test-branch",
		Create: true,
	})
	require.NoError(t, err)
	addFileToWorktreeAndCommit(
		ctx, t, config, h, repo, worktreeFS, "foo3", "hello3")
	err = wt.Checkout(&gogit.CheckoutOptions{Branch: "refs/heads/master"})
	require.NoError(t, err)
	checkAutogitTwoFiles(t, rootFS)

	t.Logf("Check the third file that's only on the branch")
	f3, err := rootFS.Open(
		".kbfs_autogit/test/.kbfs_autogit_branch_dir/" +
			".kbfs_autogit_branch_test-branch/foo3")
	require.NoError(t, err)
	defer f3.Close()
	data3, err := ioutil.ReadAll(f3)
	require.NoError(t, err)
	require.Equal(t, "hello3", string(data3))

	t.Logf("Use colons instead of slashes in the branch name")
	f4, err := rootFS.Open(
		".kbfs_autogit/test/.kbfs_autogit_branch_dir^test-branch/foo3")
	require.NoError(t, err)
	defer f4.Close()
	data4, err := ioutil.ReadAll(f4)
	require.NoError(t, err)
	require.Equal(t, "hello3", string(data4))

	t.Logf("Check non-normalized repo name")
	f5, err := rootFS.Open(".kbfs_autogit/test.git/foo")
	require.NoError(t, err)
	defer f5.Close()
	data5, err := ioutil.ReadAll(f5)
	require.NoError(t, err)
	require.Equal(t, "hello", string(data5))

	err = dotgitFS.SyncAll()
	require.NoError(t, err)
}

func TestAutogitRepoNodeReadonly(t *testing.T) {
	ctx, config, cancel, tempdir := initConfigForAutogit(t)
	defer cancel()
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	am := NewAutogitManager(config, 25)
	defer am.Shutdown()
	rw := rootWrapper{am}
	config.AddRootNodeWrapper(rw.wrap)

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "user1", tlf.Public)
	require.NoError(t, err)
	rootFS, err := libfs.NewFS(
		ctx, config, h, data.MasterBranch, "", "", keybase1.MDPriorityNormal)
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
		ctx, t, config, h, repo, worktreeFS, "foo", "hello")

	t.Log("Use autogit to open it as another user.")
	config2 := libkbfs.ConfigAsUser(config, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	am2 := NewAutogitManager(config2, 25)
	defer am2.Shutdown()
	rw2 := rootWrapper{am2}
	config2.AddRootNodeWrapper(rw2.wrap)
	rootFS2, err := libfs.NewFS(
		ctx, config2, h, data.MasterBranch, "", "",
		keybase1.MDPriorityNormal)
	require.NoError(t, err)
	checkAutogitOneFile(t, rootFS2)

	addFileToWorktree(t, repo, worktreeFS, "foo2", "hello2")
	t.Log("Repacking objects to more closely resemble a real kbfsgit push, " +
		"which only creates packfiles")
	err = repo.RepackObjects(&gogit.RepackConfig{})
	require.NoError(t, err)
	objFS, err := dotgitFS.Chroot("objects")
	require.NoError(t, err)
	fis, err := objFS.ReadDir("/")
	require.NoError(t, err)
	for _, fi := range fis {
		if fi.Name() != "pack" {
			err = libfs.RecursiveDelete(ctx, objFS.(*libfs.FS), fi)
			require.NoError(t, err)
		}
	}
	t.Log("Repacking done")
	commitWorktree(ctx, t, config, h, worktreeFS)

	t.Log("Force the source repo to update for the second user")
	srcRootNode2, _, err := config2.KBFSOps().GetOrCreateRootNode(
		ctx, h, data.MasterBranch)
	require.NoError(t, err)
	err = config2.KBFSOps().SyncFromServer(
		ctx, srcRootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	t.Log("Update the dest repo")
	dstRootNode2, _, err := config2.KBFSOps().GetOrCreateRootNode(
		ctx, h, data.MasterBranch)
	require.NoError(t, err)
	err = config2.KBFSOps().SyncFromServer(
		ctx, dstRootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	checkAutogitTwoFiles(t, rootFS2)
}

func TestAutogitCommitFile(t *testing.T) {
	ctx, config, cancel, tempdir := initConfigForAutogit(t)
	defer cancel()
	defer os.RemoveAll(tempdir)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	am := NewAutogitManager(config, 25)
	defer am.Shutdown()
	rw := rootWrapper{am}
	config.AddRootNodeWrapper(rw.wrap)

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "user1", tlf.Private)
	require.NoError(t, err)
	rootFS, err := libfs.NewFS(
		ctx, config, h, data.MasterBranch, "", "", keybase1.MDPriorityNormal)
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

	msg1 := "commit1"
	user1 := "user1"
	email1 := "user1@keyba.se"
	time1 := time.Now()
	hash1 := addFileToWorktreeWithInfo(
		t, repo, worktreeFS, "foo", "hello", msg1, user1, email1, time1)
	commitWorktree(ctx, t, config, h, worktreeFS)

	t.Log("Check the first commit -- no diff")
	headerFormat := "commit %s\nAuthor: %s <%s>\nDate:   %s\n\n    %s\n"
	expectedCommit1 := fmt.Sprintf(
		headerFormat, hash1.String(), user1, email1,
		time1.Format(object.DateFormat), msg1)

	f1, err := rootFS.Open(
		".kbfs_autogit/test.git/" + AutogitCommitPrefix + hash1.String())
	require.NoError(t, err)
	defer f1.Close()
	data1, err := ioutil.ReadAll(f1)
	require.NoError(t, err)
	require.Equal(t, expectedCommit1, string(data1))

	t.Log("Make and check a new commit")
	msg2 := "commit2"
	user2 := "user2"
	email2 := "user2@keyba.se"
	time2 := time1.Add(1 * time.Minute)
	hash2 := addFileToWorktreeWithInfo(
		t, repo, worktreeFS, "foo", "hello world", msg2, user2, email2, time2)
	commitWorktree(ctx, t, config, h, worktreeFS)

	commit1, err := repo.CommitObject(hash1)
	require.NoError(t, err)
	tree1, err := commit1.Tree()
	require.NoError(t, err)
	commit2, err := repo.CommitObject(hash2)
	require.NoError(t, err)
	tree2, err := commit2.Tree()
	require.NoError(t, err)

	entry1, err := tree1.FindEntry("foo")
	require.NoError(t, err)
	entry2, err := tree2.FindEntry("foo")
	require.NoError(t, err)

	expectedCommit2 := fmt.Sprintf(
		headerFormat, hash2.String(), user2, email2,
		time2.Format(object.DateFormat), msg2) +
		fmt.Sprintf(`diff --git a/foo b/foo
index %s..%s 100644
--- a/foo
+++ b/foo
@@ -1 +1 @@
-hello
+hello world
`, entry1.Hash.String(), entry2.Hash.String())
	f2, err := rootFS.Open(
		".kbfs_autogit/test.git/" + AutogitCommitPrefix + hash2.String())
	require.NoError(t, err)
	defer f2.Close()
	data2, err := ioutil.ReadAll(f2)
	require.NoError(t, err)
	require.Equal(t, expectedCommit2, string(data2))
}

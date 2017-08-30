// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	gogitcfg "gopkg.in/src-d/go-git.v4/config"
)

type testErrput struct {
	t *testing.T
}

func (te testErrput) Write(buf []byte) (int, error) {
	te.t.Log(string(buf))
	return 0, nil
}

func TestRunnerCapabilities(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	config := libkbfs.MakeTestConfigOrBust(t, "user1")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	input := bytes.NewBufferString("capabilities\n\n")
	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin", "keybase://private/user1/test",
		"", input, &output, testErrput{t})
	require.NoError(t, err)
	err = r.processCommands(ctx)
	require.NoError(t, err)
	require.Equal(t, "fetch\npush\n\n", output.String())
}

func initConfigForRunner(t *testing.T) (
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
		ctx, tempdir, libkbfs.TLFJournalSingleOpBackgroundWorkEnabled)
	require.NoError(t, err)

	return ctx, config, tempDir
}

func TestRunnerInitRepo(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer os.RemoveAll(tempdir)

	input := bytes.NewBufferString("list\n\n")
	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin", "keybase://private/user1/test",
		"", input, &output, testErrput{t})
	require.NoError(t, err)
	err = r.processCommands(ctx)
	require.NoError(t, err)
	// Just one symref, from HEAD to master (and master has no commits yet).
	require.Equal(t, output.String(), "@refs/heads/master HEAD\n\n")

	// Now there should be a valid git repo stored in KBFS.  Check the
	// existence of the HEAD file to be sure.
	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)
	fs, err := libfs.NewFS(ctx, config, h, ".kbfs_git/test", "")
	require.NoError(t, err)
	head, err := fs.Open("HEAD")
	require.NoError(t, err)
	buf, err := ioutil.ReadAll(head)
	require.NoError(t, err)
	require.Equal(t, "ref: refs/heads/master\n", string(buf))
}

func makeLocalRepoWithOneFile(t *testing.T,
	gitDir, filename, contents string) {
	t.Logf("Make a new repo in %s with one file", gitDir)
	err := ioutil.WriteFile(
		filepath.Join(gitDir, filename), []byte(contents), 0600)
	require.NoError(t, err)
	dotgit := filepath.Join(gitDir, ".git")
	cmd := exec.Command(
		"git", "--git-dir", dotgit, "--work-tree", gitDir, "init")
	err = cmd.Run()
	require.NoError(t, err)

	cmd = exec.Command(
		"git", "--git-dir", dotgit, "--work-tree", gitDir, "add", "foo")
	err = cmd.Run()
	require.NoError(t, err)

	cmd = exec.Command(
		"git", "--git-dir", dotgit, "--work-tree", gitDir,
		"-c", "user.name=Foo", "-c", "user.email=foo@foo.com",
		"commit", "-a", "-m", "foo")
	err = cmd.Run()
	require.NoError(t, err)
}

func testPush(t *testing.T, ctx context.Context, config libkbfs.Config,
	gitDir, refspec string) {
	// Use the runner to push the local data into the KBFS repo.
	input := bytes.NewBufferString(fmt.Sprintf(
		"push %s\n\n", refspec))
	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin", "keybase://private/user1/test",
		filepath.Join(gitDir, ".git"), input, &output, testErrput{t})
	require.NoError(t, err)
	err = r.processCommands(ctx)
	require.NoError(t, err)
	// Just one symref, from HEAD to master (and master has no commits yet).
	dst := gogitcfg.RefSpec(refspec).Dst("")
	require.Equal(t, output.String(), fmt.Sprintf("ok %s\n\n", dst))
}

func testListAndGetHeads(t *testing.T, ctx context.Context,
	config libkbfs.Config, gitDir string, expectedRefs []string) (
	heads []string) {
	input := bytes.NewBufferString("list\n\n")
	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin", "keybase://private/user1/test",
		filepath.Join(gitDir, ".git"), input, &output, testErrput{t})
	require.NoError(t, err)
	err = r.processCommands(ctx)
	require.NoError(t, err)
	listLines := strings.Split(output.String(), "\n")
	t.Log(listLines)
	require.Len(t, listLines, len(expectedRefs)+2 /* extra blank line */)
	refs := make(map[string]string, len(expectedRefs))
	for _, line := range listLines {
		if line == "" {
			continue
		}
		refParts := strings.Split(line, " ")
		require.Len(t, refParts, 2)
		refs[refParts[1]] = refParts[0]
	}

	for _, expectedRef := range expectedRefs {
		head, ok := refs[expectedRef]
		require.True(t, ok)
		heads = append(heads, head)
	}
	return heads
}

// This tests pushing code to a bare repo stored in KBFS, and pulling
// code from that bare repo into a new working tree.  This is a simple
// version of how the full KBFS Git system will work.  Specifically,
// this test does the following:
//
// 1) Initializes a new repo on the local file system with one file.
// 2) Initializes a new bare repo in KBFS.
// 3) User pushes from that repo into the remote KBFS repo.
// 4) Initializes a second new repo on the local file system.
// 5) User pulls from the remote KBFS repo into the second repo.
func TestRunnerPushFetch(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer os.RemoveAll(tempdir)

	git1, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git1)

	makeLocalRepoWithOneFile(t, git1, "foo", "hello")

	testPush(t, ctx, config, git1, "refs/heads/master:refs/heads/master")

	git2, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git2)

	t.Logf("Make a new repo in %s to clone from the KBFS repo", git2)
	dotgit2 := filepath.Join(git2, ".git")
	cmd := exec.Command(
		"git", "--git-dir", dotgit2, "--work-tree", git2, "init")
	err = cmd.Run()
	require.NoError(t, err)

	// Find out the head hash.
	heads := testListAndGetHeads(t, ctx, config, git2,
		[]string{"refs/heads/master", "HEAD"})

	// Use the runner to fetch the KBFS data into the new git repo.
	input := bytes.NewBufferString(
		fmt.Sprintf("fetch %s refs/heads/master\n\n", heads[0]))
	var output3 bytes.Buffer
	r, err := newRunner(ctx, config, "origin", "keybase://private/user1/test",
		git2, input, &output3, testErrput{t})
	require.NoError(t, err)
	err = r.processCommands(ctx)
	require.NoError(t, err)
	// Just one symref, from HEAD to master (and master has no commits yet).
	require.Equal(t, output3.String(), "\n")

	// Checkout the head directly (fetching directly via the runner
	// doesn't leave any refs, those would normally be created by the
	// `git` process that invokes the runner).
	cmd = exec.Command(
		"git", "--git-dir", dotgit2, "--work-tree", git2, "checkout", heads[0])
	err = cmd.Run()
	require.NoError(t, err)

	data, err := ioutil.ReadFile(filepath.Join(git2, "foo"))
	require.NoError(t, err)
	require.Equal(t, "hello", string(data))
}

func TestRunnerDeleteBranch(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)

	makeLocalRepoWithOneFile(t, git, "foo", "hello")

	testPush(t, ctx, config, git, "refs/heads/master:refs/heads/master")
	testPush(t, ctx, config, git, "refs/heads/master:refs/heads/test")

	// Make sure there are 2 remote branches.
	testListAndGetHeads(t, ctx, config, git,
		[]string{"refs/heads/master", "refs/heads/test", "HEAD"})

	// Delete the test branch and make sure it goes away.
	testPush(t, ctx, config, git, ":refs/heads/test")
	testListAndGetHeads(t, ctx, config, git,
		[]string{"refs/heads/master", "HEAD"})
}

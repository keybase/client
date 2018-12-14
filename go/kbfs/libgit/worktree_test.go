// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	billy "gopkg.in/src-d/go-billy.v4"
	"gopkg.in/src-d/go-billy.v4/osfs"
)

// Helper functions duplicated from kbfsgit for now, to avoid pulling
// them into the main build.  TODO: a new package for git testing
// code?
func gitExec(t *testing.T, gitDir, workTree string, command ...string) {
	cmd := exec.Command("git",
		append([]string{"--git-dir", gitDir, "--work-tree", workTree},
			command...)...)
	err := cmd.Run()
	require.NoError(t, err)
}

func makeLocalRepoWithOneFile(t *testing.T,
	gitDir, filename, contents, branch string) {
	t.Logf("Make a new repo in %s with one file", gitDir)
	err := ioutil.WriteFile(
		filepath.Join(gitDir, filename), []byte(contents), 0600)
	require.NoError(t, err)
	dotgit := filepath.Join(gitDir, ".git")
	gitExec(t, dotgit, gitDir, "init")

	if branch != "" {
		gitExec(t, dotgit, gitDir, "checkout", "-b", branch)
	}

	gitExec(t, dotgit, gitDir, "add", filename)
	gitExec(t, dotgit, gitDir, "-c", "user.name=Foo",
		"-c", "user.email=foo@foo.com", "commit", "-a", "-m", "foo")
}

func addOneFileToRepo(t *testing.T, gitDir, filename, contents string) {
	t.Logf("Add a new file to %s", gitDir)
	err := ioutil.WriteFile(
		filepath.Join(gitDir, filename), []byte(contents), 0600)
	require.NoError(t, err)
	dotgit := filepath.Join(gitDir, ".git")

	gitExec(t, dotgit, gitDir, "add", filename)
	gitExec(t, dotgit, gitDir, "-c", "user.name=Foo",
		"-c", "user.email=foo@foo.com", "commit", "-a", "-m", "foo")
}

func testCheckFile(t *testing.T, fs billy.Filesystem,
	name, expectedData string) {
	f, err := fs.Open(name)
	require.NoError(t, err)
	defer f.Close()
	data, err := ioutil.ReadAll(f)
	require.NoError(t, err)
	require.Equal(t, expectedData, string(data))
}

func TestWorktreeReset(t *testing.T) {
	git1, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git1)

	// Test our clone functions on regular file system paths, since
	// cloning a repo into KBFS here isn't simple.
	makeLocalRepoWithOneFile(t, git1, "foo", "hello", "")

	git2, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git2)

	dotgit1 := filepath.Join(git1, ".git")
	dotgit1FS := osfs.New(dotgit1)
	git2FS := osfs.New(git2)

	ctx := context.Background()
	err = Reset(ctx, dotgit1FS, git2FS, "refs/heads/master")
	require.NoError(t, err)
	testCheckFile(t, git2FS, "foo", "hello")

	// No-op.
	err = Reset(ctx, dotgit1FS, git2FS, "refs/heads/master")
	require.NoError(t, err)
	testCheckFile(t, git2FS, "foo", "hello")

	// Try a second file.
	addOneFileToRepo(t, git1, "foo2", "hello2")
	err = Reset(ctx, dotgit1FS, git2FS, "refs/heads/master")
	require.NoError(t, err)
	testCheckFile(t, git2FS, "foo", "hello")
	testCheckFile(t, git2FS, "foo2", "hello2")

	// And two more over two commits.
	addOneFileToRepo(t, git1, "foo3", "hello3")
	addOneFileToRepo(t, git1, "foo4", "hello4")
	err = Reset(ctx, dotgit1FS, git2FS, "refs/heads/master")
	require.NoError(t, err)
	testCheckFile(t, git2FS, "foo", "hello")
	testCheckFile(t, git2FS, "foo2", "hello2")
	testCheckFile(t, git2FS, "foo3", "hello3")
	testCheckFile(t, git2FS, "foo4", "hello4")

	// Now delete one.
	gitExec(t, dotgit1, git1, "rm", "-f", "foo2")
	gitExec(t, dotgit1, git1, "-c", "user.name=Foo",
		"-c", "user.email=foo@foo.com", "commit", "-a", "-m", "foo")
	err = Reset(ctx, dotgit1FS, git2FS, "refs/heads/master")
	require.NoError(t, err)
	testCheckFile(t, git2FS, "foo", "hello")
	testCheckFile(t, git2FS, "foo3", "hello3")
	testCheckFile(t, git2FS, "foo4", "hello4")
	_, err = git2FS.Stat("foo2")
	require.True(t, os.IsNotExist(err))
}

func TestWorktreeResetFromBranch(t *testing.T) {
	git1, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git1)

	// Test our clone functions on regular file system paths, since
	// cloning a repo into KBFS here isn't simple.
	makeLocalRepoWithOneFile(t, git1, "foo", "hello", "")
	dotgit1 := filepath.Join(git1, ".git")
	gitExec(t, dotgit1, git1, "checkout", "-b", "test")
	addOneFileToRepo(t, git1, "foo2", "hello2")
	// Switch back to master so regular HEAD can't be used.
	gitExec(t, dotgit1, git1, "checkout", "master")

	git2, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git2)

	dotgit1FS := osfs.New(dotgit1)
	git2FS := osfs.New(git2)

	ctx := context.Background()
	err = Reset(ctx, dotgit1FS, git2FS, "refs/heads/test")
	require.NoError(t, err)

	testCheckFile(t, git2FS, "foo", "hello")
	testCheckFile(t, git2FS, "foo2", "hello2")
}

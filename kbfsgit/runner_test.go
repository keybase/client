// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"bytes"
	"context"
	"fmt"
	"io"
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

	inputReader, inputWriter := io.Pipe()
	defer inputWriter.Close()
	go func() {
		inputWriter.Write([]byte("capabilities\n\n"))
	}()

	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin", "keybase://private/user1/test",
		"", inputReader, &output, testErrput{t})
	require.NoError(t, err)
	err = r.processCommands(ctx)
	require.NoError(t, err)
	require.Equal(t, "fetch\npush\noption\n\n", output.String())
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

	success = true
	return ctx, config, tempDir
}

func TestRunnerInitRepo(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer os.RemoveAll(tempdir)

	inputReader, inputWriter := io.Pipe()
	defer inputWriter.Close()
	go func() {
		inputWriter.Write([]byte("list\n\n"))
	}()

	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin", "keybase://private/user1/test",
		"", inputReader, &output, testErrput{t})
	require.NoError(t, err)
	err = r.processCommands(ctx)
	require.NoError(t, err)
	// No refs yet, including the HEAD symref.
	require.Equal(t, output.String(), "\n")

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
	gitDir, filename, contents, branch string) {
	t.Logf("Make a new repo in %s with one file", gitDir)
	err := ioutil.WriteFile(
		filepath.Join(gitDir, filename), []byte(contents), 0600)
	require.NoError(t, err)
	dotgit := filepath.Join(gitDir, ".git")
	cmd := exec.Command(
		"git", "--git-dir", dotgit, "--work-tree", gitDir, "init")
	err = cmd.Run()
	require.NoError(t, err)

	if branch != "" {
		cmd := exec.Command(
			"git", "--git-dir", dotgit, "--work-tree", gitDir,
			"checkout", "-b", branch)
		err = cmd.Run()
		require.NoError(t, err)
	}

	cmd = exec.Command(
		"git", "--git-dir", dotgit, "--work-tree", gitDir, "add", filename)
	err = cmd.Run()
	require.NoError(t, err)

	cmd = exec.Command(
		"git", "--git-dir", dotgit, "--work-tree", gitDir,
		"-c", "user.name=Foo", "-c", "user.email=foo@foo.com",
		"commit", "-a", "-m", "foo")
	err = cmd.Run()
	require.NoError(t, err)
}

func addOneFileToRepo(t *testing.T, gitDir, filename, contents string) {
	t.Logf("Make a new repo in %s with one file", gitDir)
	err := ioutil.WriteFile(
		filepath.Join(gitDir, filename), []byte(contents), 0600)
	require.NoError(t, err)
	dotgit := filepath.Join(gitDir, ".git")

	cmd := exec.Command(
		"git", "--git-dir", dotgit, "--work-tree", gitDir, "add", filename)
	err = cmd.Run()
	require.NoError(t, err)

	cmd = exec.Command(
		"git", "--git-dir", dotgit, "--work-tree", gitDir,
		"-c", "user.name=Foo", "-c", "user.email=foo@foo.com",
		"commit", "-a", "-m", "foo")
	err = cmd.Run()
	require.NoError(t, err)
}

func testPushWithTemplate(t *testing.T, ctx context.Context,
	config libkbfs.Config, gitDir string, refspecs []string,
	outputTemplate string) {
	// Use the runner to push the local data into the KBFS repo.
	inputReader, inputWriter := io.Pipe()
	defer inputWriter.Close()
	go func() {
		for _, refspec := range refspecs {
			inputWriter.Write([]byte(fmt.Sprintf("push %s\n", refspec)))
		}
		inputWriter.Write([]byte("\n\n"))
	}()

	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin", "keybase://private/user1/test",
		filepath.Join(gitDir, ".git"), inputReader, &output, testErrput{t})
	require.NoError(t, err)
	r.packedRefsThresh = 2
	err = r.processCommands(ctx)
	require.NoError(t, err)

	// The output can list refs in any order, so we need to compare
	// maps rather than raw strings.
	outputLines := strings.Split(output.String(), "\n")
	outputMap := make(map[string]bool)
	for _, line := range outputLines {
		outputMap[line] = true
	}

	dsts := make([]interface{}, 0, len(refspecs))
	for _, refspec := range refspecs {
		dsts = append(dsts, gogitcfg.RefSpec(refspec).Dst(""))
	}
	expectedOutput := fmt.Sprintf(outputTemplate, dsts...)
	expectedOutputLines := strings.Split(expectedOutput, "\n")
	expectedOutputMap := make(map[string]bool)
	for _, line := range expectedOutputLines {
		expectedOutputMap[line] = true
	}

	require.Equal(t, expectedOutputMap, outputMap)
}

func testPush(t *testing.T, ctx context.Context, config libkbfs.Config,
	gitDir, refspec string) {
	testPushWithTemplate(t, ctx, config, gitDir, []string{refspec}, "ok %s\n\n")
}

func testListAndGetHeads(t *testing.T, ctx context.Context,
	config libkbfs.Config, gitDir string, expectedRefs []string) (
	heads []string) {
	inputReader, inputWriter := io.Pipe()
	defer inputWriter.Close()
	go func() {
		inputWriter.Write([]byte("list\n\n"))
	}()

	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin", "keybase://private/user1/test",
		filepath.Join(gitDir, ".git"), inputReader, &output, testErrput{t})
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
func testRunnerPushFetch(t *testing.T, cloning bool, secondRepoHasBranch bool) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer os.RemoveAll(tempdir)

	git1, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git1)

	makeLocalRepoWithOneFile(t, git1, "foo", "hello", "")

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

	cloningStr := ""
	cloningRetStr := ""
	if cloning {
		cloningStr = "option cloning true\n"
		cloningRetStr = "ok\n"
	} else if secondRepoHasBranch {
		makeLocalRepoWithOneFile(t, git2, "foo2", "hello2", "b")
	}

	// Use the runner to fetch the KBFS data into the new git repo.
	inputReader, inputWriter := io.Pipe()
	defer inputWriter.Close()
	go func() {
		inputWriter.Write([]byte(fmt.Sprintf(
			"%sfetch %s refs/heads/master\n\n\n", cloningStr, heads[0])))
	}()

	var output3 bytes.Buffer
	r, err := newRunner(ctx, config, "origin", "keybase://private/user1/test",
		dotgit2, inputReader, &output3, testErrput{t})
	require.NoError(t, err)
	err = r.processCommands(ctx)
	require.NoError(t, err)
	// Just one symref, from HEAD to master (and master has no commits yet).
	require.Equal(t, cloningRetStr+"\n", output3.String())

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

func TestRunnerPushFetch(t *testing.T) {
	testRunnerPushFetch(t, false, false)
}

func TestRunnerPushClone(t *testing.T) {
	testRunnerPushFetch(t, true, false)
}

func TestRunnerPushFetchWithBranch(t *testing.T) {
	testRunnerPushFetch(t, false, true)
}

func TestRunnerDeleteBranch(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)

	makeLocalRepoWithOneFile(t, git, "foo", "hello", "")

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

func TestRunnerExitEarlyOnEOF(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)

	makeLocalRepoWithOneFile(t, git, "foo", "hello", "")

	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, libkbfs.MasterBranch)
	require.NoError(t, err)

	// Pause journal to force the processing to pause.
	jServer, err := libkbfs.GetJournalServer(config)
	require.NoError(t, err)
	jServer.PauseBackgroundWork(ctx, rootNode.GetFolderBranch().Tlf)

	// Input a full push batch, but let the reader EOF without giving
	// the final \n.
	input := bytes.NewBufferString(
		"push refs/heads/master:refs/heads/master\n\n")
	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin", "keybase://private/user1/test",
		filepath.Join(git, ".git"), input, &output, testErrput{t})
	require.NoError(t, err)

	// Make sure we don't hang when EOF comes early.
	err = r.processCommands(ctx)
	require.NoError(t, err)
}

func TestForcePush(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)

	makeLocalRepoWithOneFile(t, git, "foo", "hello", "")
	testPush(t, ctx, config, git, "refs/heads/master:refs/heads/master")

	// Push a second file.
	addOneFileToRepo(t, git, "foo2", "hello2")
	testPush(t, ctx, config, git, "refs/heads/master:refs/heads/master")

	// Now revert to the old commit and add a different file.
	dotgit := filepath.Join(git, ".git")
	cmd := exec.Command(
		"git", "--git-dir", dotgit, "--work-tree", git,
		"reset", "--hard", "HEAD~1")
	err = cmd.Run()
	require.NoError(t, err)

	addOneFileToRepo(t, git, "foo3", "hello3")
	// A non-force push should fail.
	testPushWithTemplate(
		t, ctx, config, git, []string{"refs/heads/master:refs/heads/master"},
		"error %s some refs were not updated\n\n")
	// But a force push should work
	testPush(t, ctx, config, git, "+refs/heads/master:refs/heads/master")
}

func TestPushAllWithPackedRefs(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)

	makeLocalRepoWithOneFile(t, git, "foo", "hello", "")

	dotgit := filepath.Join(git, ".git")
	cmd := exec.Command(
		"git", "--git-dir", dotgit, "--work-tree", git, "pack-refs", "--all")
	err = cmd.Run()
	require.NoError(t, err)

	testPush(t, ctx, config, git, "refs/heads/master:refs/heads/master")

	// Should be able to update the branch in a non-force way, even
	// though it's a packed-ref.
	addOneFileToRepo(t, git, "foo2", "hello2")
	testPush(t, ctx, config, git, "refs/heads/master:refs/heads/master")
}

func TestPushSomeWithPackedRefs(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)

	makeLocalRepoWithOneFile(t, git, "foo", "hello", "")

	// Make a non-branch ref (under refs/test).  This ref would not be
	// pushed as part of `git push --all`.
	dotgit := filepath.Join(git, ".git")
	cmd := exec.Command(
		"git", "--git-dir", dotgit, "--work-tree", git,
		"push", git, "HEAD:refs/test/ref")
	err = cmd.Run()
	require.NoError(t, err)

	addOneFileToRepo(t, git, "foo2", "hello2")

	// Make a tag, and then another branch.
	cmd = exec.Command(
		"git", "--git-dir", dotgit, "--work-tree", git, "tag", "v0")
	err = cmd.Run()
	require.NoError(t, err)

	cmd = exec.Command(
		"git", "--git-dir", dotgit, "--work-tree", git,
		"checkout", "-b", "test")
	err = cmd.Run()
	require.NoError(t, err)
	addOneFileToRepo(t, git, "foo3", "hello3")

	// Simulate a `git push --all`, and make sure `refs/test/ref`
	// isn't pushed.
	testPushWithTemplate(
		t, ctx, config, git, []string{
			"refs/heads/master:refs/heads/master",
			"refs/heads/test:refs/heads/test",
			"refs/tags/v0:refs/tags/v0",
		},
		"ok %s\nok %s\nok %s\n\n")
	testListAndGetHeads(t, ctx, config, git,
		[]string{
			"refs/heads/master",
			"refs/heads/test",
			"refs/tags/v0",
			"HEAD",
		})

	// Make sure we can push over a packed-refs ref.
	addOneFileToRepo(t, git, "foo4", "hello4")
	testPush(t, ctx, config, git, "refs/heads/test:refs/heads/test")
}

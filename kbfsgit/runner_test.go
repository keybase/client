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

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libgit"
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
		t, 0, libkbfs.InitSingleOp, "user1", "user2")
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

func testRunnerInitRepo(t *testing.T, tlfType tlf.Type, typeString string) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	inputReader, inputWriter := io.Pipe()
	defer inputWriter.Close()
	go func() {
		inputWriter.Write([]byte("list\n\n"))
	}()

	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlfType)
	require.NoError(t, err)
	if tlfType != tlf.Public {
		_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
		require.NoError(t, err)
	}

	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin",
		fmt.Sprintf("keybase://%s/user1/test", typeString),
		"", inputReader, &output, testErrput{t})
	require.NoError(t, err)
	err = r.processCommands(ctx)
	require.NoError(t, err)
	// No refs yet, including the HEAD symref.
	require.Equal(t, output.String(), "\n")

	// Now there should be a valid git repo stored in KBFS.  Check the
	// existence of the HEAD file to be sure.
	fs, err := libfs.NewFS(ctx, config, h, ".kbfs_git/test", "", keybase1.MDPriorityGit)
	require.NoError(t, err)
	head, err := fs.Open("HEAD")
	require.NoError(t, err)
	buf, err := ioutil.ReadAll(head)
	require.NoError(t, err)
	require.Equal(t, "ref: refs/heads/master\n", string(buf))
}

func TestRunnerInitRepoPrivate(t *testing.T) {
	testRunnerInitRepo(t, tlf.Private, "private")
}

func TestRunnerInitRepoPublic(t *testing.T) {
	testRunnerInitRepo(t, tlf.Public, "public")
}

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
	t.Logf("Make a new repo in %s with one file", gitDir)
	err := ioutil.WriteFile(
		filepath.Join(gitDir, filename), []byte(contents), 0600)
	require.NoError(t, err)
	dotgit := filepath.Join(gitDir, ".git")

	gitExec(t, dotgit, gitDir, "add", filename)
	gitExec(t, dotgit, gitDir, "-c", "user.name=Foo",
		"-c", "user.email=foo@foo.com", "commit", "-a", "-m", "foo")
}

func testPushWithTemplate(t *testing.T, ctx context.Context,
	config libkbfs.Config, gitDir string, refspecs []string,
	outputTemplate, tlfName string) {
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
	r, err := newRunner(ctx, config, "origin",
		fmt.Sprintf("keybase://private/%s/test", tlfName),
		filepath.Join(gitDir, ".git"), inputReader, &output, testErrput{t})
	require.NoError(t, err)
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
	testPushWithTemplate(t, ctx, config, gitDir, []string{refspec},
		"ok %s\n\n", "user1")
}

func testListAndGetHeadsWithName(t *testing.T, ctx context.Context,
	config libkbfs.Config, gitDir string, expectedRefs []string,
	tlfName string) (heads []string) {
	inputReader, inputWriter := io.Pipe()
	defer inputWriter.Close()
	go func() {
		inputWriter.Write([]byte("list\n\n"))
	}()

	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin",
		fmt.Sprintf("keybase://private/%s/test", tlfName),
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

func testListAndGetHeads(t *testing.T, ctx context.Context,
	config libkbfs.Config, gitDir string, expectedRefs []string) (
	heads []string) {
	return testListAndGetHeadsWithName(
		t, ctx, config, gitDir, expectedRefs, "user1")
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
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git1, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git1)

	makeLocalRepoWithOneFile(t, git1, "foo", "hello", "")

	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

	testPush(t, ctx, config, git1, "refs/heads/master:refs/heads/master")

	git2, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git2)

	t.Logf("Make a new repo in %s to clone from the KBFS repo", git2)
	dotgit2 := filepath.Join(git2, ".git")
	gitExec(t, dotgit2, git2, "init")

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
	gitExec(t, dotgit2, git2, "checkout", heads[0])

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
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)

	makeLocalRepoWithOneFile(t, git, "foo", "hello", "")

	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

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
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
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
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
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
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)

	makeLocalRepoWithOneFile(t, git, "foo", "hello", "")

	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

	testPush(t, ctx, config, git, "refs/heads/master:refs/heads/master")

	// Push a second file.
	addOneFileToRepo(t, git, "foo2", "hello2")
	testPush(t, ctx, config, git, "refs/heads/master:refs/heads/master")

	// Now revert to the old commit and add a different file.
	dotgit := filepath.Join(git, ".git")
	gitExec(t, dotgit, git, "reset", "--hard", "HEAD~1")

	addOneFileToRepo(t, git, "foo3", "hello3")
	// A non-force push should fail.
	testPushWithTemplate(
		t, ctx, config, git, []string{"refs/heads/master:refs/heads/master"},
		"error %s some refs were not updated\n\n", "user1")
	// But a force push should work
	testPush(t, ctx, config, git, "+refs/heads/master:refs/heads/master")
}

func TestPushAllWithPackedRefs(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)

	makeLocalRepoWithOneFile(t, git, "foo", "hello", "")

	dotgit := filepath.Join(git, ".git")
	gitExec(t, dotgit, git, "pack-refs", "--all")

	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

	testPush(t, ctx, config, git, "refs/heads/master:refs/heads/master")

	// Should be able to update the branch in a non-force way, even
	// though it's a packed-ref.
	addOneFileToRepo(t, git, "foo2", "hello2")
	testPush(t, ctx, config, git, "refs/heads/master:refs/heads/master")
}

func TestPushSomeWithPackedRefs(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)

	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

	makeLocalRepoWithOneFile(t, git, "foo", "hello", "")

	// Make a non-branch ref (under refs/test).  This ref would not be
	// pushed as part of `git push --all`.
	dotgit := filepath.Join(git, ".git")
	gitExec(t, dotgit, git, "push", git, "HEAD:refs/test/ref")

	addOneFileToRepo(t, git, "foo2", "hello2")

	// Make a tag, and then another branch.
	gitExec(t, dotgit, git, "tag", "v0")
	gitExec(t, dotgit, git, "checkout", "-b", "test")
	addOneFileToRepo(t, git, "foo3", "hello3")

	// Simulate a `git push --all`, and make sure `refs/test/ref`
	// isn't pushed.
	testPushWithTemplate(
		t, ctx, config, git, []string{
			"refs/heads/master:refs/heads/master",
			"refs/heads/test:refs/heads/test",
			"refs/tags/v0:refs/tags/v0",
		},
		"ok %s\nok %s\nok %s\n\n", "user1")
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

func TestRunnerReaderClone(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git1, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git1)

	makeLocalRepoWithOneFile(t, git1, "foo", "hello", "")
	testPushWithTemplate(t, ctx, config, git1,
		[]string{"refs/heads/master:refs/heads/master"},
		"ok %s\n\n", "user1#user2")

	// Make sure the reader can clone it.
	config2 := libkbfs.ConfigAsUser(config, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	tempdir2, err := ioutil.TempDir(os.TempDir(), "journal_server")
	require.NoError(t, err)
	defer os.RemoveAll(tempdir2)
	err = config2.EnableDiskLimiter(tempdir2)
	require.NoError(t, err)
	err = config2.EnableJournaling(
		ctx, tempdir2, libkbfs.TLFJournalSingleOpBackgroundWorkEnabled)
	require.NoError(t, err)

	git2, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git2)
	dotgit2 := filepath.Join(git2, ".git")

	gitExec(t, dotgit2, git2, "init")

	heads := testListAndGetHeadsWithName(t, ctx, config2, git2,
		[]string{"refs/heads/master", "HEAD"}, "user1#user2")

	inputReader2, inputWriter2 := io.Pipe()
	defer inputWriter2.Close()
	go func() {
		inputWriter2.Write([]byte(fmt.Sprintf(
			"option cloning true\n"+
				"fetch %s refs/heads/master\n\n\n", heads[0])))
	}()

	var output2 bytes.Buffer
	r2, err := newRunner(ctx, config2, "origin",
		fmt.Sprintf("keybase://private/user1#user2/test"),
		dotgit2, inputReader2, &output2, testErrput{t})
	require.NoError(t, err)
	err = r2.processCommands(ctx)
	require.NoError(t, err)
	// Just one symref, from HEAD to master (and master has no commits yet).
	require.Equal(t, "ok\n\n", output2.String())

	// Checkout the head directly (fetching directly via the runner
	// doesn't leave any refs, those would normally be created by the
	// `git` process that invokes the runner).
	gitExec(t, dotgit2, git2, "checkout", heads[0])

	data, err := ioutil.ReadFile(filepath.Join(git2, "foo"))
	require.NoError(t, err)
	require.Equal(t, "hello", string(data))
}

func TestRunnerDeletePackedRef(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git1, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git1)
	dotgit1 := filepath.Join(git1, ".git")

	makeLocalRepoWithOneFile(t, git1, "foo", "hello", "b")

	// Add a different file to master.
	gitExec(t, dotgit1, git1, "checkout", "-b", "master")
	addOneFileToRepo(t, git1, "foo2", "hello2")

	gitExec(t, dotgit1, git1, "pack-refs", "--all")

	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

	testPushWithTemplate(
		t, ctx, config, git1, []string{
			"refs/heads/master:refs/heads/master",
			"refs/heads/b:refs/heads/b",
		},
		"ok %s\nok %s\n\n", "user1")

	testListAndGetHeadsWithName(t, ctx, config, git1,
		[]string{"refs/heads/master", "refs/heads/b", "HEAD"}, "user1")

	// Add a new file to the branch and push, to create a loose ref.
	gitExec(t, dotgit1, git1, "checkout", "b")
	addOneFileToRepo(t, git1, "foo3", "hello3")
	testPush(t, ctx, config, git1, "refs/heads/b:refs/heads/b")

	// Now delete.
	testPush(t, ctx, config, git1, ":refs/heads/b")
	testListAndGetHeadsWithName(t, ctx, config, git1,
		[]string{"refs/heads/master", "HEAD"}, "user1")
}

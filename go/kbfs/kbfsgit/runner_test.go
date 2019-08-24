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
	"runtime"
	"strings"
	"testing"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libgit"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	gogitcfg "gopkg.in/src-d/go-git.v4/config"
)

type testErrput struct {
	t *testing.T
}

func (te testErrput) Write(buf []byte) (int, error) {
	te.t.Helper()
	te.t.Log(string(buf))
	return 0, nil
}

func TestRunnerCapabilities(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	config := libkbfs.MakeTestConfigOrBustLoggedInWithMode(
		t, 0, libkbfs.InitSingleOp, "user1")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	inputReader, inputWriter := io.Pipe()
	defer inputWriter.Close()
	go func() {
		_, _ = inputWriter.Write([]byte("capabilities\n\n"))
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
	ctx context.Context, config *libkbfs.ConfigLocal, tempdir string) {
	ctx = libcontext.BackgroundContextWithCancellationDelayer()
	config = libkbfs.MakeTestConfigOrBustLoggedInWithMode(
		t, 0, libkbfs.InitSingleOp, "user1", "user2")
	success := false
	ctx = context.WithValue(ctx, libkbfs.CtxAllowNameKey, kbfsRepoDir)

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
	return ctx, config, tempdir
}

func testRunnerInitRepo(t *testing.T, tlfType tlf.Type, typeString string) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	inputReader, inputWriter := io.Pipe()
	defer inputWriter.Close()
	go func() {
		_, _ = inputWriter.Write([]byte("list\n\n"))
	}()

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), config, "user1", tlfType)
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
	fs, err := libfs.NewFS(
		ctx, config, h, data.MasterBranch, ".kbfs_git/test", "",
		keybase1.MDPriorityGit)
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
	output, err := cmd.CombinedOutput()
	require.NoError(t, err, string(output))
}

func makeLocalRepoWithOneFileCustomCommitMsg(t *testing.T,
	gitDir, filename, contents, branch, msg string) {
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
		"-c", "user.email=foo@foo.com", "commit", "-a", "-m", msg)
}

func makeLocalRepoWithOneFile(t *testing.T,
	gitDir, filename, contents, branch string) {
	makeLocalRepoWithOneFileCustomCommitMsg(
		t, gitDir, filename, contents, branch, "foo")
}

func addOneFileToRepoCustomCommitMsg(t *testing.T, gitDir,
	filename, contents, msg string) {
	t.Logf("Add a new file to %s", gitDir)
	err := ioutil.WriteFile(
		filepath.Join(gitDir, filename), []byte(contents), 0600)
	require.NoError(t, err)
	dotgit := filepath.Join(gitDir, ".git")

	gitExec(t, dotgit, gitDir, "add", filename)
	gitExec(t, dotgit, gitDir, "-c", "user.name=Foo",
		"-c", "user.email=foo@foo.com", "commit", "-a", "-m", msg)
}

func addOneFileToRepo(t *testing.T, gitDir, filename, contents string) {
	addOneFileToRepoCustomCommitMsg(
		t, gitDir, filename, contents, "foo")
}

func testPushWithTemplate(ctx context.Context, t *testing.T,
	config libkbfs.Config, gitDir string, refspecs []string,
	outputTemplate, tlfName string) {
	// Use the runner to push the local data into the KBFS repo.
	inputReader, inputWriter := io.Pipe()
	defer inputWriter.Close()
	go func() {
		for _, refspec := range refspecs {
			_, _ = inputWriter.Write([]byte(fmt.Sprintf("push %s\n", refspec)))
		}
		_, _ = inputWriter.Write([]byte("\n\n"))
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

func testPush(ctx context.Context, t *testing.T, config libkbfs.Config,
	gitDir, refspec string) {
	testPushWithTemplate(ctx, t, config, gitDir, []string{refspec},
		"ok %s\n\n", "user1")
}

func testListAndGetHeadsWithName(ctx context.Context, t *testing.T,
	config libkbfs.Config, gitDir string, expectedRefs []string,
	tlfName string) (heads []string) {
	inputReader, inputWriter := io.Pipe()
	defer inputWriter.Close()
	go func() {
		_, _ = inputWriter.Write([]byte("list\n\n"))
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

func testListAndGetHeads(ctx context.Context, t *testing.T,
	config libkbfs.Config, gitDir string, expectedRefs []string) (
	heads []string) {
	return testListAndGetHeadsWithName(
		ctx, t, config, gitDir, expectedRefs, "user1")
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

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), config, "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

	testPush(ctx, t, config, git1, "refs/heads/master:refs/heads/master")

	git2, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git2)

	t.Logf("Make a new repo in %s to clone from the KBFS repo", git2)
	dotgit2 := filepath.Join(git2, ".git")
	gitExec(t, dotgit2, git2, "init")

	// Find out the head hash.
	heads := testListAndGetHeads(ctx, t, config, git2,
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
		_, _ = inputWriter.Write([]byte(fmt.Sprintf(
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
	t.Skip("KBFS-3778: currently flaking")
	testRunnerPushFetch(t, false, false)
}

func TestRunnerPushClone(t *testing.T) {
	testRunnerPushFetch(t, true, false)
}

func TestRunnerPushFetchWithBranch(t *testing.T) {
	t.Skip("KBFS-3589: currently flaking")
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

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), config, "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

	testPush(ctx, t, config, git, "refs/heads/master:refs/heads/master")
	testPush(ctx, t, config, git, "refs/heads/master:refs/heads/test")

	// Make sure there are 2 remote branches.
	testListAndGetHeads(ctx, t, config, git,
		[]string{"refs/heads/master", "refs/heads/test", "HEAD"})

	// Delete the test branch and make sure it goes away.
	testPush(ctx, t, config, git, ":refs/heads/test")
	testListAndGetHeads(ctx, t, config, git,
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

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), config, "user1", tlf.Private)
	require.NoError(t, err)
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, data.MasterBranch)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

	// Pause journal to force the processing to pause.
	jManager, err := libkbfs.GetJournalManager(config)
	require.NoError(t, err)
	jManager.PauseBackgroundWork(ctx, rootNode.GetFolderBranch().Tlf)

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

	err = config.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
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

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), config, "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

	testPush(ctx, t, config, git, "refs/heads/master:refs/heads/master")

	// Push a second file.
	addOneFileToRepo(t, git, "foo2", "hello2")
	testPush(ctx, t, config, git, "refs/heads/master:refs/heads/master")

	// Now revert to the old commit and add a different file.
	dotgit := filepath.Join(git, ".git")
	gitExec(t, dotgit, git, "reset", "--hard", "HEAD~1")

	addOneFileToRepo(t, git, "foo3", "hello3")
	// A non-force push should fail.
	testPushWithTemplate(
		ctx, t, config, git, []string{"refs/heads/master:refs/heads/master"},
		"error %s some refs were not updated\n\n", "user1")
	// But a force push should work
	testPush(ctx, t, config, git, "+refs/heads/master:refs/heads/master")
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

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), config, "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

	testPush(ctx, t, config, git, "refs/heads/master:refs/heads/master")

	// Should be able to update the branch in a non-force way, even
	// though it's a packed-ref.
	addOneFileToRepo(t, git, "foo2", "hello2")
	testPush(ctx, t, config, git, "refs/heads/master:refs/heads/master")
}

func TestPushSomeWithPackedRefs(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), config, "user1", tlf.Private)
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
		ctx, t, config, git, []string{
			"refs/heads/master:refs/heads/master",
			"refs/heads/test:refs/heads/test",
			"refs/tags/v0:refs/tags/v0",
		},
		"ok %s\nok %s\nok %s\n\n", "user1")
	testListAndGetHeads(ctx, t, config, git,
		[]string{
			"refs/heads/master",
			"refs/heads/test",
			"refs/tags/v0",
			"HEAD",
		})

	// Make sure we can push over a packed-refs ref.
	addOneFileToRepo(t, git, "foo4", "hello4")
	testPush(ctx, t, config, git, "refs/heads/test:refs/heads/test")
}

func testCloneIntoNewLocalRepo(
	ctx context.Context, t *testing.T, config libkbfs.Config,
	tlfName string) string {
	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	success := false
	defer func() {
		if !success {
			os.RemoveAll(git)
		}
	}()

	dotgit := filepath.Join(git, ".git")
	gitExec(t, dotgit, git, "init")

	heads := testListAndGetHeadsWithName(ctx, t, config, git,
		[]string{"refs/heads/master", "HEAD"}, tlfName)

	inputReader, inputWriter := io.Pipe()
	defer inputWriter.Close()
	go func() {
		_, _ = inputWriter.Write([]byte(fmt.Sprintf(
			"option cloning true\n"+
				"fetch %s refs/heads/master\n\n\n", heads[0])))
	}()

	var output bytes.Buffer
	r2, err := newRunner(ctx, config, "origin",
		fmt.Sprintf("keybase://private/%s/test", tlfName),
		dotgit, inputReader, &output, testErrput{t})
	require.NoError(t, err)
	err = r2.processCommands(ctx)
	require.NoError(t, err)
	// Just one symref, from HEAD to master (and master has no commits yet).
	require.Equal(t, "ok\n\n", output.String())

	// Checkout the head directly (fetching directly via the runner
	// doesn't leave any refs, those would normally be created by the
	// `git` process that invokes the runner).
	gitExec(t, dotgit, git, "checkout", heads[0])

	success = true
	return git
}

func TestRunnerReaderClone(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git1, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git1)

	makeLocalRepoWithOneFile(t, git1, "foo", "hello", "")
	testPushWithTemplate(ctx, t, config, git1,
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

	git2 := testCloneIntoNewLocalRepo(ctx, t, config2, "user1#user2")
	defer os.RemoveAll(git2)

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

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), config, "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

	testPushWithTemplate(
		ctx, t, config, git1, []string{
			"refs/heads/master:refs/heads/master",
			"refs/heads/b:refs/heads/b",
		},
		"ok %s\nok %s\n\n", "user1")

	testListAndGetHeadsWithName(ctx, t, config, git1,
		[]string{"refs/heads/master", "refs/heads/b", "HEAD"}, "user1")

	// Add a new file to the branch and push, to create a loose ref.
	gitExec(t, dotgit1, git1, "checkout", "b")
	addOneFileToRepo(t, git1, "foo3", "hello3")
	testPush(ctx, t, config, git1, "refs/heads/b:refs/heads/b")

	// Now delete.
	testPush(ctx, t, config, git1, ":refs/heads/b")
	testListAndGetHeadsWithName(ctx, t, config, git1,
		[]string{"refs/heads/master", "HEAD"}, "user1")
}

func TestPushcertOptions(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)
	dotgit := filepath.Join(git, ".git")

	checkPushcert := func(option, expected string) {
		inputReader, inputWriter := io.Pipe()
		defer inputWriter.Close()
		go func() {
			_, _ = inputWriter.Write([]byte(fmt.Sprintf(
				"option pushcert %s\n\n", option)))
		}()

		var output bytes.Buffer
		r, err := newRunner(ctx, config, "origin",
			fmt.Sprintf("keybase://private/user1/test"),
			dotgit, inputReader, &output, testErrput{t})
		require.NoError(t, err)
		err = r.processCommands(ctx)
		require.NoError(t, err)
		// if-asked is supported, but signing will never be asked for.
		require.Equal(t, fmt.Sprintf("%s\n", expected), output.String())
	}

	checkPushcert("if-asked", "ok")
	checkPushcert("true", "unsupported")
	checkPushcert("false", "ok")
}

func TestPackRefsAndOverwritePackedRef(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git1, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git1)

	// Make shared repo with 2 branches.
	makeLocalRepoWithOneFile(t, git1, "foo", "hello", "")
	testPushWithTemplate(ctx, t, config, git1,
		[]string{"refs/heads/master:refs/heads/master"},
		"ok %s\n\n", "user1,user2")
	testPushWithTemplate(ctx, t, config, git1,
		[]string{"refs/heads/master:refs/heads/test"},
		"ok %s\n\n", "user1,user2")

	// Config for the second user.
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

	heads := testListAndGetHeadsWithName(ctx, t, config2, git2,
		[]string{"refs/heads/master", "refs/heads/test", "HEAD"}, "user1,user2")
	require.Equal(t, heads[0], heads[1])

	// Have the second user refpack, but stall it after it takes the lock.
	packOnStalled, packUnstall, packCtx := libkbfs.StallMDOp(
		ctx, config2, libkbfs.StallableMDAfterGetRange, 1)
	packErrCh := make(chan error)
	h, err := tlfhandle.ParseHandle(
		ctx, config2.KBPKI(), config.MDOps(), config, "user1,user2",
		tlf.Private)
	require.NoError(t, err)
	go func() {
		packErrCh <- libgit.GCRepo(
			packCtx, config2, h, "test", libgit.GCOptions{
				MaxLooseRefs:   0,
				MaxObjectPacks: -1,
			})
	}()
	select {
	case <-packOnStalled:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	// While the second user is stalled, have the first user update
	// one of the refs.
	addOneFileToRepo(t, git1, "foo2", "hello2")
	testPushWithTemplate(ctx, t, config, git1,
		[]string{"refs/heads/master:refs/heads/test"},
		"ok %s\n\n", "user1,user2")

	close(packUnstall)
	select {
	case err := <-packErrCh:
		require.NoError(t, err)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	rootNode, _, err := config2.KBFSOps().GetOrCreateRootNode(
		ctx, h, data.MasterBranch)
	require.NoError(t, err)
	err = config2.KBFSOps().SyncFromServer(
		ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
	heads = testListAndGetHeadsWithName(ctx, t, config2, git2,
		[]string{"refs/heads/master", "refs/heads/test", "HEAD"}, "user1,user2")
	require.NotEqual(t, heads[0], heads[1])
}

func TestPackRefsAndDeletePackedRef(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git1, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git1)
	dotgit1 := filepath.Join(git1, ".git")

	// Make shared repo with 2 branches.  Make sure there's an initial
	// pack-refs file.
	makeLocalRepoWithOneFile(t, git1, "foo", "hello", "")
	gitExec(t, dotgit1, git1, "pack-refs", "--all")
	testPushWithTemplate(ctx, t, config, git1,
		[]string{"refs/heads/master:refs/heads/master"},
		"ok %s\n\n", "user1,user2")
	testPushWithTemplate(ctx, t, config, git1,
		[]string{"refs/heads/master:refs/heads/test"},
		"ok %s\n\n", "user1,user2")

	// Config for the second user.
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

	heads := testListAndGetHeadsWithName(ctx, t, config2, git2,
		[]string{"refs/heads/master", "refs/heads/test", "HEAD"}, "user1,user2")
	require.Equal(t, heads[0], heads[1])

	// Have the second user refpack, but stall it after it takes the lock.
	packOnStalled, packUnstall, packCtx := libkbfs.StallMDOp(
		ctx, config2, libkbfs.StallableMDAfterGetRange, 1)
	packErrCh := make(chan error)
	h, err := tlfhandle.ParseHandle(
		ctx, config2.KBPKI(), config.MDOps(), config, "user1,user2",
		tlf.Private)
	require.NoError(t, err)
	go func() {
		packErrCh <- libgit.GCRepo(
			packCtx, config2, h, "test", libgit.GCOptions{
				MaxLooseRefs:   0,
				MaxObjectPacks: -1,
			})
	}()
	select {
	case <-packOnStalled:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	// While the second user is stalled, have the first user delete
	// one of the refs.  Wait until it tries to get the lock, and then
	// release the pack-refs call.
	deleteOnStalled, deleteUnstall, deleteCtx := libkbfs.StallMDOp(
		ctx, config, libkbfs.StallableMDGetRange, 1)
	inputReader, inputWriter := io.Pipe()
	defer inputWriter.Close()
	go func() {
		_, _ = inputWriter.Write([]byte("push :refs/heads/test\n"))
		_, _ = inputWriter.Write([]byte("\n\n"))
	}()

	var output bytes.Buffer
	deleteRunner, err := newRunner(ctx, config, "origin",
		"keybase://private/user1,user2/test",
		dotgit1, inputReader, &output, testErrput{t})
	require.NoError(t, err)
	deleteErrCh := make(chan error)
	go func() {
		deleteErrCh <- deleteRunner.processCommands(deleteCtx)
	}()
	select {
	case <-deleteOnStalled:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	// Release it, and it should block on getting the lock.
	close(deleteUnstall)

	// Now let the pack-refs finish.
	close(packUnstall)
	select {
	case err := <-packErrCh:
		require.NoError(t, err)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	// And the delete should finish right after.
	select {
	case err := <-deleteErrCh:
		require.NoError(t, err)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	rootNode, _, err := config2.KBFSOps().GetOrCreateRootNode(
		ctx, h, data.MasterBranch)
	require.NoError(t, err)
	err = config2.KBFSOps().SyncFromServer(
		ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
	testListAndGetHeadsWithName(ctx, t, config2, git2,
		[]string{"refs/heads/master", "HEAD"}, "user1,user2")
}

func TestRepackObjects(t *testing.T) {
	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), config, "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

	// Make a few pushes to make a few object pack files.
	makeLocalRepoWithOneFile(t, git, "foo", "hello", "")
	testPush(ctx, t, config, git, "refs/heads/master:refs/heads/master")
	addOneFileToRepo(t, git, "foo2", "hello2")
	testPush(ctx, t, config, git, "refs/heads/master:refs/heads/master")
	addOneFileToRepo(t, git, "foo3", "hello3")
	testPush(ctx, t, config, git, "refs/heads/master:refs/heads/master")
	addOneFileToRepo(t, git, "foo4", "hello4")
	testPush(ctx, t, config, git, "refs/heads/master:refs/heads/master")

	fs, _, err := libgit.GetRepoAndID(ctx, config, h, "test", "")
	require.NoError(t, err)

	storage, err := libgit.NewGitConfigWithoutRemotesStorer(fs)
	require.NoError(t, err)
	packs, err := storage.ObjectPacks()
	require.NoError(t, err)
	numObjectPacks := len(packs)
	require.Equal(t, 3, numObjectPacks)

	// Re-pack them all into one.
	err = libgit.GCRepo(
		ctx, config, h, "test", libgit.GCOptions{
			MaxLooseRefs:   100,
			MaxObjectPacks: 0,
		})
	require.NoError(t, err)

	packs, err = storage.ObjectPacks()
	require.NoError(t, err)
	numObjectPacks = len(packs)
	require.Equal(t, 1, numObjectPacks)

	// Check that a second clone looks correct.
	git2 := testCloneIntoNewLocalRepo(ctx, t, config, "user1")
	defer os.RemoveAll(git2)

	checkFile := func(name, expectedData string) {
		data, err := ioutil.ReadFile(filepath.Join(git2, name))
		require.NoError(t, err)
		require.Equal(t, expectedData, string(data))
	}
	checkFile("foo", "hello")
	checkFile("foo2", "hello2")
	checkFile("foo3", "hello3")
	checkFile("foo4", "hello4")
}

func testHandlePushBatch(ctx context.Context, t *testing.T,
	config libkbfs.Config, git, refspec, tlfName string) libgit.RefDataByName {
	var input bytes.Buffer
	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin",
		fmt.Sprintf("keybase://private/%s/test", tlfName),
		filepath.Join(git, ".git"), &input, &output, testErrput{t})
	require.NoError(t, err)

	args := [][]string{{refspec}}
	commits, err := r.handlePushBatch(ctx, args)
	require.NoError(t, err)
	return commits
}

func TestRunnerHandlePushBatch(t *testing.T) {
	t.Skip("KBFS-3836: currently flaking a lot")
	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	git, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git)

	t.Log("Setup the repository.")
	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), config, "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)

	t.Log("Make a new local repo with one commit, and push it. " +
		"We expect this to return no commits, since it should push the " +
		"whole repository.")
	makeLocalRepoWithOneFileCustomCommitMsg(t, git, "foo", "hello", "", "one")
	refDataByName := testHandlePushBatch(ctx, t, config, git,
		"refs/heads/master:refs/heads/master", "user1")
	require.Len(t, refDataByName, 1)
	master := refDataByName["refs/heads/master"]
	require.False(t, master.IsDelete)
	commits := master.Commits
	require.Len(t, commits, 1)
	require.Equal(t, "one", strings.TrimSpace(commits[0].Message))

	t.Log("Add a commit and push it. We expect the push batch to return " +
		"one reference with one commit.")
	addOneFileToRepoCustomCommitMsg(t, git, "foo2", "hello2", "two")
	refDataByName = testHandlePushBatch(ctx, t, config, git,
		"refs/heads/master:refs/heads/master", "user1")
	require.Len(t, refDataByName, 1)
	master = refDataByName["refs/heads/master"]
	require.False(t, master.IsDelete)
	commits = master.Commits
	require.Len(t, commits, 1)
	require.Equal(t, "two", strings.TrimSpace(commits[0].Message))

	t.Log("Add three commits. We expect the push batch to return " +
		"one reference with three commits. The commits should be ordered " +
		"with the most recent first.")
	addOneFileToRepoCustomCommitMsg(t, git, "foo3", "hello3", "three")
	addOneFileToRepoCustomCommitMsg(t, git, "foo4", "hello4", "four")
	addOneFileToRepoCustomCommitMsg(t, git, "foo5", "hello5", "five")
	refDataByName = testHandlePushBatch(ctx, t, config, git,
		"refs/heads/master:refs/heads/master", "user1")
	require.Len(t, refDataByName, 1)
	master = refDataByName["refs/heads/master"]
	require.False(t, master.IsDelete)
	commits = master.Commits
	require.Len(t, commits, 3)
	require.Equal(t, "five", strings.TrimSpace(commits[0].Message))
	require.Equal(t, "four", strings.TrimSpace(commits[1].Message))
	require.Equal(t, "three", strings.TrimSpace(commits[2].Message))

	t.Log("Add more commits than the maximum to visit per ref. " +
		"Check that a sentinel value was added.")
	for i := 0; i < maxCommitsToVisitPerRef+1; i++ {
		filename := fmt.Sprintf("foo%d", i+6)
		content := fmt.Sprintf("hello%d", i+6)
		msg := fmt.Sprintf("commit message %d", i+6)
		addOneFileToRepoCustomCommitMsg(t, git, filename, content, msg)
	}
	refDataByName = testHandlePushBatch(ctx, t, config, git,
		"refs/heads/master:refs/heads/master", "user1")
	require.Len(t, refDataByName, 1)
	master = refDataByName["refs/heads/master"]
	require.False(t, master.IsDelete)
	commits = master.Commits
	require.Len(t, commits, maxCommitsToVisitPerRef)
	require.Equal(t, libgit.CommitSentinelValue, commits[maxCommitsToVisitPerRef-1])

	t.Log("Push a deletion.")
	refDataByName = testHandlePushBatch(ctx, t, config, git,
		":refs/heads/master", "user1")
	require.Len(t, refDataByName, 1)
	master = refDataByName["refs/heads/master"]
	require.True(t, master.IsDelete)
	require.Len(t, master.Commits, 0)
}

func TestRunnerSubmodule(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("submodule add doesn't work well on Windows")
	}

	ctx, config, tempdir := initConfigForRunner(t)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	shutdown := libgit.StartAutogit(config, 25)
	defer shutdown()

	t.Log("Make a local repo that will become a KBFS repo")
	git1, err := ioutil.TempDir(os.TempDir(), "kbfsgittest")
	require.NoError(t, err)
	defer os.RemoveAll(git1)
	makeLocalRepoWithOneFile(t, git1, "foo", "hello", "")
	dotgit1 := filepath.Join(git1, ".git")

	t.Log("Make a second local repo that will be a submodule")
	git2, err := ioutil.TempDir(os.TempDir(), "kbfsgittest2")
	require.NoError(t, err)
	defer os.RemoveAll(git2)
	makeLocalRepoWithOneFile(t, git2, "foo2", "hello2", "")
	dotgit2 := filepath.Join(git2, ".git")

	t.Log("Add the submodule to the first local repo")
	// git-submodules requires a real working directory for some reason.
	err = os.Chdir(git1)
	require.NoError(t, err)
	gitExec(t, dotgit1, git1, "submodule", "add", "-f", dotgit2)
	gitExec(t, dotgit1, git1, "-c", "user.name=Foo",
		"-c", "user.email=foo@foo.com", "commit", "-a", "-m", "submodule")

	t.Log("Push the first local repo into KBFS")
	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), config, "user1", tlf.Private)
	require.NoError(t, err)
	_, err = libgit.CreateRepoAndID(ctx, config, h, "test")
	require.NoError(t, err)
	testPush(ctx, t, config, git1, "refs/heads/master:refs/heads/master")

	t.Log("Use autogit to browse it")
	rootFS, err := libfs.NewFS(
		ctx, config, h, data.MasterBranch, "", "", keybase1.MDPriorityNormal)
	require.NoError(t, err)
	fis, err := rootFS.ReadDir(".kbfs_autogit/test")
	require.NoError(t, err)
	require.Len(t, fis, 3 /* foo, kbfsgittest2, and .gitmodules */)
	f, err := rootFS.Open(".kbfs_autogit/test/" + filepath.Base(git2))
	require.NoError(t, err)
	defer f.Close()
	data, err := ioutil.ReadAll(f)
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(string(data), "git submodule"))
}

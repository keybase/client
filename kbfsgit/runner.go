// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"path"
	"strings"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	gogit "gopkg.in/src-d/go-git.v4"
	gogitcfg "gopkg.in/src-d/go-git.v4/config"
	"gopkg.in/src-d/go-git.v4/plumbing"
)

const (
	gitCmdCapabilities = "capabilities"
	gitCmdList         = "list"
	gitCmdFetch        = "fetch"
	gitCmdPush         = "push"

	// Debug tag ID for an individual git command passed to the process.
	ctxCommandOpID = "GITCMDID"

	kbfsgitPrefix = "keybase://"
	repoSplitter  = "/"
	kbfsRepoDir   = ".kbfs_git"

	publicName  = "public"
	privateName = "private"
	teamName    = "team"

	// localRepoRemoteName is the name of the remote that gets added
	// locally to the config of the KBFS bare repo, pointing to the
	// git repo stored at the `gitDir` passed to `newRunner`.
	//
	// In go-git, there is no way to hook two go-git.Repository
	// instances together to do fetches/pulls between them. One of the
	// two repos has to be defined as a "remote" to the other one in
	// order to use the nice Fetch and Pull commands. (There might be
	// other more involved ways to transfer objects manually
	// one-by-one, but that seems like it would be pretty sad.)
	//
	// Since there is no standard remote protocol for keybase yet
	// (that's what we're building!), it's not supported by go-git
	// itself. That means our only option is to treat the local
	// on-disk repo as a "remote" with respect to the bare KBFS repo,
	// and do everything in reverse: for example, when a user does a
	// push, we actually fetch from the local repo and write the
	// objects into the bare repo.
	localRepoRemoteName = "local"
)

type ctxCommandTagKey int

const (
	ctxCommandIDKey ctxCommandTagKey = iota
)

func getHandleFromFolderName(ctx context.Context, config libkbfs.Config,
	tlfName string, t tlf.Type) (*libkbfs.TlfHandle, error) {
	for {
		tlfHandle, err := libkbfs.ParseTlfHandle(
			ctx, config.KBPKI(), tlfName, t)
		switch e := errors.Cause(err).(type) {
		case libkbfs.TlfNameNotCanonical:
			tlfName = e.NameToTry
		case nil:
			return tlfHandle, nil
		default:
			return nil, err
		}
	}
}

type runner struct {
	config libkbfs.Config
	log    logger.Logger
	h      *libkbfs.TlfHandle
	remote string
	repo   string
	gitDir string
	uniqID string
	input  io.Reader
	output io.Writer
}

// newRunner creates a new runner for git commands.  It expects `repo`
// to be in the form "keybase://private/user/reponame".
func newRunner(ctx context.Context, config libkbfs.Config,
	remote, repo, gitDir string, input io.Reader, output io.Writer) (
	*runner, error) {
	tlfAndRepo := strings.TrimPrefix(repo, kbfsgitPrefix)
	parts := strings.Split(tlfAndRepo, repoSplitter)
	if len(parts) != 3 {
		return nil, errors.Errorf("Repo should be in the format "+
			"%s<tlfType>%s<tlf>%s<repo>, but got %s",
			kbfsgitPrefix, repoSplitter, repoSplitter, tlfAndRepo)
	}

	var t tlf.Type
	switch parts[0] {
	case publicName:
		t = tlf.Public
	case privateName:
		t = tlf.Private
	case teamName:
		t = tlf.SingleTeam
	default:
		return nil, errors.Errorf("Unrecognized TLF type: %s", parts[0])
	}

	h, err := getHandleFromFolderName(ctx, config, parts[1], t)
	if err != nil {
		return nil, err
	}

	// Use the device ID and PID to make a unique ID (for generating
	// temp files in KBFS).
	session, err := libkbfs.GetCurrentSessionIfPossible(
		ctx, config.KBPKI(), h.Type() == tlf.Public)
	if err != nil {
		return nil, err
	}
	uniqID := session.VerifyingKey.String() + "-" + string(os.Getpid())

	return &runner{
		config: config,
		log:    config.MakeLogger(""),
		h:      h,
		remote: remote,
		repo:   parts[2],
		gitDir: gitDir,
		uniqID: uniqID,
		input:  input,
		output: output}, nil
}

// handleCapabilities: from https://git-scm.com/docs/git-remote-helpers
//
// Lists the capabilities of the helper, one per line, ending with a
// blank line. Each capability may be preceded with *, which marks
// them mandatory for git versions using the remote helper to
// understand. Any unknown mandatory capability is a fatal error.
func (r *runner) handleCapabilities() error {
	caps := []string{
		gitCmdFetch,
		gitCmdPush,
	}
	for _, c := range caps {
		_, err := r.output.Write([]byte(c + "\n"))
		if err != nil {
			return err
		}
	}
	_, err := r.output.Write([]byte("\n"))
	return err
}

func (r *runner) initRepoIfNeeded(ctx context.Context) (
	*gogit.Repository, error) {
	rootNode, _, err := r.config.KBFSOps().GetOrCreateRootNode(
		ctx, r.h, libkbfs.MasterBranch)
	if err != nil {
		return nil, err
	}

	lookupOrCreateDir := func(n libkbfs.Node, name string) (
		libkbfs.Node, error) {
		newNode, _, err := r.config.KBFSOps().Lookup(ctx, n, name)
		switch errors.Cause(err).(type) {
		case libkbfs.NoSuchNameError:
			newNode, _, err = r.config.KBFSOps().CreateDir(ctx, n, name)
			if err != nil {
				return nil, err
			}
		case nil:
		default:
			return nil, err
		}
		return newNode, nil
	}

	repoDir, err := lookupOrCreateDir(rootNode, kbfsRepoDir)
	if err != nil {
		return nil, err
	}
	_, err = lookupOrCreateDir(repoDir, r.repo)
	if err != nil {
		return nil, err
	}

	fs, err := libfs.NewFS(
		ctx, r.config, r.h, path.Join(kbfsRepoDir, r.repo), r.uniqID)
	if err != nil {
		return nil, err
	}

	// We don't persist remotes to the config on disk for two
	// reasons. 1) gogit/gcfg has a bug where it can't handle
	// backslashes in remote URLs, and 2) we don't want to persist the
	// remotes anyway since they'll contain local paths and wouldn't
	// make sense to other devices, plus that could leak local info.
	storer, err := newConfigWithoutRemotesStorer(fs)
	if err != nil {
		return nil, err
	}

	// TODO: This needs to take a server lock when initializing a
	// repo.
	r.log.CDebugf(ctx, "Attempting to init or open repo %s", r.repo)
	repo, err := gogit.Init(storer, nil)
	if err == gogit.ErrRepositoryAlreadyExists {
		repo, err = gogit.Open(storer, nil)
	}
	if err != nil {
		return nil, err
	}

	return repo, nil
}

func (r *runner) waitForJournal(ctx context.Context) error {
	rootNode, _, err := r.config.KBFSOps().GetOrCreateRootNode(
		ctx, r.h, libkbfs.MasterBranch)
	if err != nil {
		return err
	}

	err = r.config.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		return err
	}

	jServer, err := libkbfs.GetJournalServer(r.config)
	if err != nil {
		r.log.CDebugf(ctx, "No journal server: %+v", err)
		return nil
	}

	err = jServer.Wait(ctx, rootNode.GetFolderBranch().Tlf)
	if err != nil {
		return err
	}

	// Make sure that everything is truly flushed.
	status, err := jServer.JournalStatus(rootNode.GetFolderBranch().Tlf)
	if err != nil {
		return err
	}

	if status.RevisionStart != kbfsmd.RevisionUninitialized {
		r.log.CDebugf(ctx, "Journal status: %+v", status)
		return errors.New("Journal is non-empty after a wait")
	}
	return nil
}

// handleList: From https://git-scm.com/docs/git-remote-helpers
//
// Lists the refs, one per line, in the format "<value> <name> [<attr>
// …​]". The value may be a hex sha1 hash, "@<dest>" for a symref, or
// "?" to indicate that the helper could not get the value of the
// ref. A space-separated list of attributes follows the name;
// unrecognized attributes are ignored. The list ends with a blank
// line.
func (r *runner) handleList(ctx context.Context, args []string) (err error) {
	if len(args) > 0 {
		return errors.New("Lists for non-fetches unsupported for now")
	}

	repo, err := r.initRepoIfNeeded(ctx)
	if err != nil {
		return err
	}

	refs, err := repo.References()
	if err != nil {
		return err
	}

	for {
		ref, err := refs.Next()
		if errors.Cause(err) == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		value := ""
		switch ref.Type() {
		case plumbing.HashReference:
			value = ref.Hash().String()
		case plumbing.SymbolicReference:
			value = "@" + ref.Target().String()
		default:
			value = "?"
		}
		refStr := value + " " + ref.Name().String() + "\n"
		_, err = r.output.Write([]byte(refStr))
		if err != nil {
			return err
		}
	}

	err = r.waitForJournal(ctx)
	if err != nil {
		return err
	}
	r.log.CDebugf(ctx, "Done waiting for journal")

	_, err = r.output.Write([]byte("\n"))
	return err
}

// handleFetchBatch: From https://git-scm.com/docs/git-remote-helpers
//
// fetch <sha1> <name>
// Fetches the given object, writing the necessary objects to the
// database. Fetch commands are sent in a batch, one per line,
// terminated with a blank line. Outputs a single blank line when all
// fetch commands in the same batch are complete. Only objects which
// were reported in the output of list with a sha1 may be fetched this
// way.
//
// Optionally may output a lock <file> line indicating a file under
// GIT_DIR/objects/pack which is keeping a pack until refs can be
// suitably updated.
func (r *runner) handleFetchBatch(ctx context.Context, args [][]string) (
	err error) {
	repo, err := r.initRepoIfNeeded(ctx)
	if err != nil {
		return err
	}

	r.log.CDebugf(ctx, "Fetching %d refs into %s", len(args), r.gitDir)

	remote, err := repo.CreateRemote(&gogitcfg.RemoteConfig{
		Name: localRepoRemoteName,
		URL:  r.gitDir,
	})

	for _, fetch := range args {
		if len(fetch) != 2 {
			return errors.Errorf("Bad fetch request: %v", fetch)
		}
		refInBareRepo := fetch[1]

		// Push into a local ref with a temporary name, because the
		// git process that invoked us will get confused if we make a
		// ref with the same name.  Later, delete this temporary ref.
		localTempRef := plumbing.ReferenceName(refInBareRepo).Short() +
			"-" + r.uniqID
		refSpec := fmt.Sprintf(
			"%s:refs/remotes/%s/%s", refInBareRepo, r.remote, localTempRef)
		r.log.CDebugf(ctx, "Fetching %s", refSpec)

		// Now "push" into the local repo to get it to store objects
		// from the KBFS bare repo.
		err = remote.Push(&gogit.PushOptions{
			RemoteName: localRepoRemoteName,
			RefSpecs:   []gogitcfg.RefSpec{gogitcfg.RefSpec(refSpec)},
		})
		if err != nil && err != gogit.NoErrAlreadyUpToDate {
			return err
		}

		// Delete the temporary refspec now that the objects are
		// safely stored in the local repo.
		refSpec = fmt.Sprintf(":refs/remotes/%s/%s", r.remote, localTempRef)
		err = remote.Push(&gogit.PushOptions{
			RemoteName: localRepoRemoteName,
			RefSpecs:   []gogitcfg.RefSpec{gogitcfg.RefSpec(refSpec)},
		})
		if err != nil && err != gogit.NoErrAlreadyUpToDate {
			return err
		}
	}

	err = r.waitForJournal(ctx)
	if err != nil {
		return err
	}
	r.log.CDebugf(ctx, "Done waiting for journal")

	_, err = r.output.Write([]byte("\n"))
	return err
}

func (r *runner) processCommands(ctx context.Context) (err error) {
	r.log.CDebugf(ctx, "Ready to process")
	reader := bufio.NewReader(r.input)
	var fetchBatch [][]string
	for {
		cmd, err := reader.ReadString('\n')
		if errors.Cause(err) == io.EOF {
			r.log.CDebugf(ctx, "Done processing commands")
			return nil
		} else if err != nil {
			return err
		}

		ctx := libkbfs.CtxWithRandomIDReplayable(
			ctx, ctxCommandIDKey, ctxCommandOpID, r.log)

		cmdParts := strings.Fields(cmd)
		if len(cmdParts) == 0 {
			if len(fetchBatch) > 0 {
				r.log.CDebugf(ctx, "Processing fetch batch")
				err = r.handleFetchBatch(ctx, fetchBatch)
				if err != nil {
					return err
				}
				fetchBatch = nil
				continue
			} else {
				r.log.CDebugf(ctx, "Done processing commands")
				return nil
			}
		}

		r.log.CDebugf(ctx, "Received command: %s", cmd)

		switch cmdParts[0] {
		case gitCmdCapabilities:
			err = r.handleCapabilities()
		case gitCmdList:
			err = r.handleList(ctx, cmdParts[1:])
		case gitCmdFetch:
			fetchBatch = append(fetchBatch, cmdParts[1:])
		default:
			err = errors.Errorf("Unsupported command: %s", cmdParts[0])
		}
		if err != nil {
			return err
		}
	}
}

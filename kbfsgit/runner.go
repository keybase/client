// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"bufio"
	"context"
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
	repo   string
	uniqID string
	input  io.Reader
	output io.Writer
}

// newRunner creates a new runner for git commands.  It expects `repo`
// to be in the form "keybase://private/user/reponame".
func newRunner(ctx context.Context, config libkbfs.Config, repo string,
	input io.Reader, output io.Writer) (*runner, error) {
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
		repo:   parts[2],
		uniqID: uniqID,
		input:  input,
		output: output}, nil
}

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

	// We store the config in memory for two reasons. 1) gogit/gcfg
	// has a bug where it can't handle backslashes in remote URLs, and
	// 2) we don't want to flush the remotes since they'll contain
	// local paths.
	storer, err := newConfigInMemoryStorer(fs)
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

func (r *runner) handleList(ctx context.Context, args []string) error {
	if len(args) > 0 {
		return errors.New("Lists for non-fetches unsupported for now")
	}

	_, err := r.initRepoIfNeeded(ctx)
	if err != nil {
		return err
	}

	err = r.waitForJournal(ctx)
	if err != nil {
		return err
	}
	r.log.CDebugf(ctx, "Done waiting for journal")

	// TODO(KBFS-2353/KBFS-2354): list actual references from the repo.
	_, err = r.output.Write([]byte("\n"))
	return err
}

func (r *runner) processCommands(ctx context.Context) error {
	r.log.CDebugf(ctx, "Ready to process")
	reader := bufio.NewReader(r.input)
	for {
		cmd, err := reader.ReadString('\n')
		if err != nil {
			return err
		}
		cmdParts := strings.Fields(cmd)
		if len(cmdParts) == 0 {
			r.log.CDebugf(ctx, "Done processing commands")
			return nil
		}

		ctx := libkbfs.CtxWithRandomIDReplayable(
			ctx, ctxCommandIDKey, ctxCommandOpID, r.log)
		r.log.CDebugf(ctx, "Received command: %s", cmd)

		switch cmdParts[0] {
		case gitCmdCapabilities:
			err = r.handleCapabilities()
		case gitCmdList:
			err = r.handleList(ctx, cmdParts[1:])
		default:
			err = errors.Errorf("Unsupported command: %s", cmdParts[0])
		}
		if err != nil {
			return err
		}

	}
}

// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"os"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

type RPCHandler struct {
	config libkbfs.Config
	log    logger.Logger
}

// NewRPCHandler returns a new instance of a Git RPC handler.
func NewRPCHandler(config libkbfs.Config) keybase1.KBFSGitInterface {
	return &RPCHandler{
		config: config,
		log:    config.MakeLogger(""),
	}
}

var _ keybase1.KBFSGitInterface = (*RPCHandler)(nil)

func (rh *RPCHandler) waitForJournal(
	ctx context.Context, config libkbfs.Config, h *libkbfs.TlfHandle) error {
	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, h, libkbfs.MasterBranch)
	if err != nil {
		return err
	}

	err = config.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		return err
	}

	jServer, err := libkbfs.GetJournalServer(config)
	if err != nil {
		rh.log.CDebugf(ctx, "No journal server: %+v", err)
		return nil
	}

	// This squashes everything written to the journal into a single
	// revision, to make sure that no partial states of the bare repo
	// are seen by other readers of the TLF.  It also waits for any
	// necessary conflict resolution to complete.
	err = jServer.FinishSingleOp(ctx, rootNode.GetFolderBranch().Tlf)
	if err != nil {
		return err
	}

	// Make sure that everything is truly flushed.
	status, err := jServer.JournalStatus(rootNode.GetFolderBranch().Tlf)
	if err != nil {
		return err
	}

	if status.RevisionStart != kbfsmd.RevisionUninitialized {
		rh.log.CDebugf(ctx, "Journal status: %+v", status)
		return errors.New("Journal is non-empty after a wait")
	}
	return nil
}

// KeybaseServiceCn defines methods needed to construct KeybaseService
// and Crypto implementations.
type keybaseServicePassthrough struct {
	config libkbfs.Config
}

func (ksp keybaseServicePassthrough) NewKeybaseService(
	_ libkbfs.Config, _ libkbfs.InitParams, _ libkbfs.Context,
	_ logger.Logger) (libkbfs.KeybaseService, error) {
	return ksp.config.KeybaseService(), nil
}

func (ksp keybaseServicePassthrough) NewCrypto(
	_ libkbfs.Config, _ libkbfs.InitParams, _ libkbfs.Context,
	_ logger.Logger) (libkbfs.Crypto, error) {
	return ksp.config.Crypto(), nil
}

var _ libkbfs.KeybaseServiceCn = keybaseServicePassthrough{}

// CreateRepo implements keybase1.KBFSGitInterface for KeybaseServiceBase.
func (rh *RPCHandler) CreateRepo(
	ctx context.Context, arg keybase1.CreateRepoArg) (
	id keybase1.RepoID, err error) {
	rh.log.CDebugf(ctx, "Creating repo %s in folder %s/%s",
		arg.Name, arg.Folder.FolderType, arg.Folder.Name)
	defer func() {
		rh.log.CDebugf(ctx, "Done creating repo: %+v", err)
	}()

	// Make sure we have a legit folder name.
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, rh.config.KBPKI(), arg.Folder.Name,
		tlf.TypeFromFolderType(arg.Folder.FolderType))
	if err != nil {
		return "", err
	}

	// Initialize libgit.
	kbCtx := env.NewContext()
	params, tempDir, err := Params(kbCtx, rh.config.StorageRoot())
	if err != nil {
		return "", err
	}
	defer func() {
		rmErr := os.RemoveAll(tempDir)
		if rmErr != nil {
			rh.log.CDebugf(
				ctx, "Error cleaning storage dir %s: %+v\n", tempDir, rmErr)
		}
	}()

	// Let the init code know it shouldn't try to change the
	// global logger settings.
	params.LogToFile = false
	params.LogFileConfig.Path = ""

	ctx, config, err := Init(
		ctx, params, kbCtx, keybaseServicePassthrough{rh.config}, "")
	if err != nil {
		return "", err
	}
	defer config.Shutdown(ctx)

	gitID, err := CreateRepoAndID(ctx, config, tlfHandle, string(arg.Name))
	if err != nil {
		return "", err
	}

	err = rh.waitForJournal(ctx, config, tlfHandle)
	if err != nil {
		return "", err
	}

	return keybase1.RepoID(gitID.String()), nil
}

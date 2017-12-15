// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"os"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// RPCHandler handles service->KBFS git RPC calls.
type RPCHandler struct {
	kbCtx          libkbfs.Context
	config         libkbfs.Config
	kbfsInitParams *libkbfs.InitParams
	log            logger.Logger
}

// NewRPCHandlerWithCtx returns a new instance of a Git RPC handler.
func NewRPCHandlerWithCtx(kbCtx libkbfs.Context, config libkbfs.Config,
	kbfsInitParams *libkbfs.InitParams) keybase1.KBFSGitInterface {
	return &RPCHandler{
		kbCtx:          kbCtx,
		config:         config,
		kbfsInitParams: kbfsInitParams,
		log:            config.MakeLogger(""),
	}
}

var _ keybase1.KBFSGitInterface = (*RPCHandler)(nil)

func (rh *RPCHandler) waitForJournal(
	ctx context.Context, gitConfig libkbfs.Config,
	h *libkbfs.TlfHandle) error {
	err := CleanOldDeletedReposTimeLimited(ctx, gitConfig, h)
	if err != nil {
		return err
	}

	rootNode, _, err := gitConfig.KBFSOps().GetOrCreateRootNode(
		ctx, h, libkbfs.MasterBranch)
	if err != nil {
		return err
	}

	err = gitConfig.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		return err
	}

	jServer, err := libkbfs.GetJournalServer(gitConfig)
	if err != nil {
		rh.log.CDebugf(ctx, "No journal server: %+v", err)
		return nil
	}

	// This squashes everything written to the journal into a single
	// revision, to make sure that no partial states of the bare repo
	// are seen by other readers of the TLF.  It also waits for any
	// necessary conflict resolution to complete.
	err = jServer.FinishSingleOp(ctx,
		rootNode.GetFolderBranch().Tlf, nil, keybase1.MDPriorityGit)
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

func (rh *RPCHandler) getHandleAndConfig(
	ctx context.Context, folder keybase1.Folder) (
	newCtx context.Context, gitConfig libkbfs.Config,
	tlfHandle *libkbfs.TlfHandle, tempDir string, err error) {
	// Make sure we have a legit folder name.
	tlfHandle, err = libkbfs.GetHandleFromFolderNameAndType(
		ctx, rh.config.KBPKI(), rh.config.MDOps(), folder.Name,
		tlf.TypeFromFolderType(folder.FolderType))
	if err != nil {
		return nil, nil, nil, "", err
	}

	// Initialize libgit.
	params, tempDir, err := Params(rh.kbCtx,
		rh.config.StorageRoot(), rh.kbfsInitParams)
	if err != nil {
		return nil, nil, nil, "", err
	}
	defer func() {
		if err != nil {
			rmErr := os.RemoveAll(tempDir)
			if rmErr != nil {
				rh.log.CDebugf(
					ctx, "Error cleaning storage dir %s: %+v\n", tempDir, rmErr)
			}
		}
	}()

	// Let the init code know it shouldn't try to change the
	// global logger settings.
	params.LogToFile = false
	params.LogFileConfig.Path = ""

	newCtx, gitConfig, err = Init(
		ctx, params, rh.kbCtx, keybaseServicePassthrough{rh.config}, "")
	if err != nil {
		return nil, nil, nil, "", err
	}

	return newCtx, gitConfig, tlfHandle, tempDir, nil
}

// CreateRepo implements keybase1.KBFSGitInterface for KeybaseServiceBase.
func (rh *RPCHandler) CreateRepo(
	ctx context.Context, arg keybase1.CreateRepoArg) (
	id keybase1.RepoID, err error) {
	rh.log.CDebugf(ctx, "Creating repo %s in folder %s/%s",
		arg.Name, arg.Folder.FolderType, arg.Folder.Name)
	defer func() {
		rh.log.CDebugf(ctx, "Done creating repo: %+v", err)
	}()

	ctx, gitConfig, tlfHandle, tempDir, err := rh.getHandleAndConfig(
		ctx, arg.Folder)
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
	defer gitConfig.Shutdown(ctx)

	gitID, err := CreateRepoAndID(ctx, gitConfig, tlfHandle, string(arg.Name))
	if err != nil {
		return "", err
	}

	err = rh.waitForJournal(ctx, gitConfig, tlfHandle)
	if err != nil {
		return "", err
	}

	return keybase1.RepoID(gitID.String()), nil
}

func (rh *RPCHandler) scheduleCleaning(folder keybase1.Folder) {
	// TODO: cancel outstanding timers on shutdown, if we ever utilize
	// the DeleteRepo RPC handler in a test.
	time.AfterFunc(minDeletedAgeForCleaning+1*time.Second, func() {
		log := rh.config.MakeLogger("")

		ctx, gitConfig, tlfHandle, tempDir, err := rh.getHandleAndConfig(
			context.Background(), folder)
		if err != nil {
			log.CDebugf(nil, "Couldn't init for scheduled cleaning of %s: %+v",
				folder.Name, err)
			return
		}
		defer func() {
			rmErr := os.RemoveAll(tempDir)
			if rmErr != nil {
				rh.log.CDebugf(
					ctx, "Error cleaning storage dir %s: %+v\n", tempDir, rmErr)
			}
		}()
		defer gitConfig.Shutdown(ctx)

		log.CDebugf(ctx, "Starting a scheduled repo clean for folder %s",
			tlfHandle.GetCanonicalPath())
		err = CleanOldDeletedRepos(ctx, gitConfig, tlfHandle)
		if err != nil {
			log.CDebugf(ctx, "Couldn't clean folder %s: %+v",
				tlfHandle.GetCanonicalPath(), err)
			return
		}

		err = rh.waitForJournal(ctx, gitConfig, tlfHandle)
		if err != nil {
			log.CDebugf(ctx, "Error waiting for journal after cleaning "+
				"folder %s: %+v", tlfHandle.GetCanonicalPath(), err)
			return
		}
	})
}

// DeleteRepo implements keybase1.KBFSGitInterface for KeybaseServiceBase.
func (rh *RPCHandler) DeleteRepo(
	ctx context.Context, arg keybase1.DeleteRepoArg) (err error) {
	rh.log.CDebugf(ctx, "Deleting repo %s from folder %s/%s",
		arg.Name, arg.Folder.FolderType, arg.Folder.Name)
	defer func() {
		rh.log.CDebugf(ctx, "Done deleting repo: %+v", err)
	}()

	ctx, gitConfig, tlfHandle, tempDir, err := rh.getHandleAndConfig(
		ctx, arg.Folder)
	if err != nil {
		return err
	}
	defer func() {
		rmErr := os.RemoveAll(tempDir)
		if rmErr != nil {
			rh.log.CDebugf(
				ctx, "Error cleaning storage dir %s: %+v\n", tempDir, rmErr)
		}
	}()
	defer gitConfig.Shutdown(ctx)

	err = DeleteRepo(ctx, gitConfig, tlfHandle, string(arg.Name))
	if err != nil {
		return err
	}

	err = rh.waitForJournal(ctx, gitConfig, tlfHandle)
	if err != nil {
		return err
	}

	rh.scheduleCleaning(arg.Folder)
	return nil
}

// Gc implements keybase1.KBFSGitInterface for KeybaseServiceBase.
func (rh *RPCHandler) Gc(
	ctx context.Context, arg keybase1.GcArg) (err error) {
	rh.log.CDebugf(ctx, "Garbage-collecting repo %s from folder %s/%s",
		arg.Name, arg.Folder.FolderType, arg.Folder.Name)
	defer func() {
		rh.log.CDebugf(ctx, "Done garbage-collecting repo: %+v", err)
	}()

	ctx, gitConfig, tlfHandle, tempDir, err := rh.getHandleAndConfig(
		ctx, arg.Folder)
	if err != nil {
		return err
	}
	defer func() {
		rmErr := os.RemoveAll(tempDir)
		if rmErr != nil {
			rh.log.CDebugf(
				ctx, "Error cleaning storage dir %s: %+v\n", tempDir, rmErr)
		}
	}()
	defer gitConfig.Shutdown(ctx)

	gco := GCOptions{
		MaxLooseRefs:         arg.Options.MaxLooseRefs,
		PruneMinLooseObjects: arg.Options.PruneMinLooseObjects,
		PruneExpireTime:      keybase1.FromTime(arg.Options.PruneExpireTime),
	}
	err = GCRepo(ctx, gitConfig, tlfHandle, string(arg.Name), gco)
	if err != nil {
		return err
	}

	return rh.waitForJournal(ctx, gitConfig, tlfHandle)
}

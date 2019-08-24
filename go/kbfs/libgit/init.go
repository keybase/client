// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"io/ioutil"
	"os"

	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
)

const (
	// Debug tag ID for a batched set of git operations under a single
	// config.
	ctxGitOpID = "GITID"
)

type ctxGitTagKey int

const (
	paramKeybaseGitMDServerAddr = "KEYBASE_GIT_MDSERVER_ADDR"
	paramKeybaseGitBServerAddr  = "KEYBASE_GIT_BSERVER_ADDR"
)

const (
	ctxGitIDKey ctxGitTagKey = iota
)

// Params returns a set of default parameters for git-related
// operations, along with a temp directory that should be cleaned
// after the git work is complete.
func Params(kbCtx libkbfs.Context,
	storageRoot string, paramsBase *libkbfs.InitParams) (
	params libkbfs.InitParams, tempDir string, err error) {
	tempDir, err = ioutil.TempDir(storageRoot, libkbfs.GitStorageRootPrefix)
	if err != nil {
		return libkbfs.InitParams{}, "", err
	}

	if paramsBase != nil {
		params = *paramsBase
	} else {
		params = libkbfs.DefaultInitParams(kbCtx)
	}
	params.LogToFile = true
	// Set the debug default to true only if the env variable isn't
	// explicitly set to a false option.
	envDebug := os.Getenv("KBFSGIT_DEBUG")
	if envDebug != "0" && envDebug != "false" && envDebug != "no" {
		params.Debug = true
	}
	// This is set to false in docker tests for now, but we need it. So
	// override it to true here.
	params.EnableJournal = true
	params.DiskCacheMode = libkbfs.DiskCacheModeRemote
	params.StorageRoot = tempDir
	params.Mode = libkbfs.InitSingleOpString
	params.TLFJournalBackgroundWorkStatus =
		libkbfs.TLFJournalSingleOpBackgroundWorkEnabled

	if baddr := os.Getenv(paramKeybaseGitBServerAddr); len(baddr) > 0 {
		params.BServerAddr = baddr
	}
	if mdaddr := os.Getenv(paramKeybaseGitMDServerAddr); len(mdaddr) > 0 {
		params.MDServerAddr = mdaddr
	}

	return params, tempDir, nil
}

// Init initializes a context and a libkbfs.Config for git operations.
// The config should be shutdown when it is done being used.
func Init(ctx context.Context, gitKBFSParams libkbfs.InitParams,
	kbCtx libkbfs.Context, keybaseServiceCn libkbfs.KeybaseServiceCn,
	defaultLogPath string, vlogLevel string) (
	context.Context, libkbfs.Config, error) {
	log, err := libkbfs.InitLogWithPrefix(
		gitKBFSParams, kbCtx, "git", defaultLogPath)
	if err != nil {
		return ctx, nil, err
	}

	// Assign a unique ID to each remote-helper instance, since
	// they'll all share the same log.
	ctx, err = libcontext.NewContextWithCancellationDelayer(
		libkbfs.CtxWithRandomIDReplayable(
			ctx, ctxGitIDKey, ctxGitOpID, log))
	if err != nil {
		return ctx, nil, err
	}
	log.CDebugf(ctx, "Initialized new git config")

	config, err := libkbfs.InitWithLogPrefix(
		ctx, kbCtx, gitKBFSParams, keybaseServiceCn, nil, log, "git")
	if err != nil {
		return ctx, nil, err
	}
	config.SetVLogLevel(vlogLevel)

	// Make any blocks written by via this config charged to the git
	// quota.
	config.SetDefaultBlockType(keybase1.BlockType_GIT)

	err = config.MakeDiskBlockCacheIfNotExists()
	if err != nil {
		log.CDebugf(ctx, "Couldn't initialize disk cache: %+v", err)
	}

	return ctx, config, nil
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

func (ksp keybaseServicePassthrough) NewChat(
	_ libkbfs.Config, _ libkbfs.InitParams, _ libkbfs.Context,
	_ logger.Logger) (libkbfs.Chat, error) {
	return ksp.config.Chat(), nil
}

var _ libkbfs.KeybaseServiceCn = keybaseServicePassthrough{}

func getNewConfig(
	ctx context.Context, config libkbfs.Config, kbCtx libkbfs.Context,
	kbfsInitParams *libkbfs.InitParams, log logger.Logger) (
	newCtx context.Context, gitConfig libkbfs.Config,
	tempDir string, err error) {
	// Initialize libgit.
	params, tempDir, err := Params(kbCtx, config.StorageRoot(), kbfsInitParams)
	if err != nil {
		return nil, nil, "", err
	}
	defer func() {
		if err != nil {
			rmErr := os.RemoveAll(tempDir)
			if rmErr != nil {
				log.CDebugf(
					ctx, "Error cleaning storage dir %s: %+v\n", tempDir, rmErr)
			}
		}
	}()

	// Let the init code know it shouldn't try to change the
	// global logger settings.
	params.LogToFile = false
	params.LogFileConfig.Path = ""

	newCtx, gitConfig, err = Init(
		ctx, params, kbCtx, keybaseServicePassthrough{config}, "",
		config.VLogLevel())
	if err != nil {
		return nil, nil, "", err
	}
	return newCtx, gitConfig, tempDir, nil
}

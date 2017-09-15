// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"io/ioutil"
	"os"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/libkbfs"
)

const (
	// Debug tag ID for a batched set of git operations under a single
	// config.
	ctxGitOpID = "GITID"
)

type ctxGitTagKey int

const (
	ctxGitIDKey ctxGitTagKey = iota
)

// Params returns a set of default parameters for git-related
// operations, along with a temp directory that should be cleaned
// after the git work is complete.
func Params(kbCtx libkbfs.Context, storageRoot string) (
	params libkbfs.InitParams, tempDir string, err error) {
	// TODO(KBFS-2443): Also remove all kbfsgit directories older than
	// an hour.
	tempDir, err = ioutil.TempDir(storageRoot, "kbfsgit")
	if err != nil {
		return libkbfs.InitParams{}, "", err
	}

	params = libkbfs.DefaultInitParams(kbCtx)
	params.LogToFile = true
	// Set the debug default to true only if the env variable isn't
	// explicitly set to a false option.
	envDebug := os.Getenv("KBFSGIT_DEBUG")
	if envDebug != "0" && envDebug != "false" && envDebug != "no" {
		params.Debug = true
	}
	params.EnableDiskCache = false
	params.StorageRoot = tempDir
	params.Mode = libkbfs.InitSingleOpString
	params.TLFJournalBackgroundWorkStatus =
		libkbfs.TLFJournalSingleOpBackgroundWorkEnabled
	return params, tempDir, nil
}

// Init initializes a context and a libkbfs.Config for git operations.
// The config should be shutdown when it is done being used.
func Init(ctx context.Context, kbfsParams libkbfs.InitParams,
	kbCtx libkbfs.Context, keybaseServiceCn libkbfs.KeybaseServiceCn,
	defaultLogPath string) (context.Context, libkbfs.Config, error) {
	log, err := libkbfs.InitLogWithPrefix(
		kbfsParams, kbCtx, "git", defaultLogPath)
	if err != nil {
		return ctx, nil, err
	}

	// Assign a unique ID to each remote-helper instance, since
	// they'll all share the same log.
	ctx, err = libkbfs.NewContextWithCancellationDelayer(
		libkbfs.CtxWithRandomIDReplayable(
			ctx, ctxGitIDKey, ctxGitOpID, log))
	if err != nil {
		return ctx, nil, err
	}
	log.CDebugf(ctx, "Initialized new git config")

	config, err := libkbfs.InitWithLogPrefix(
		ctx, kbCtx, kbfsParams, keybaseServiceCn, nil, log, "git")
	if err != nil {
		return ctx, nil, err
	}

	// Make any blocks written by via this config charged to the git
	// quota.
	config.SetDefaultBlockType(keybase1.BlockType_GIT)

	return ctx, config, nil
}

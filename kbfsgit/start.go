// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"context"
	"io"

	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
)

// StartOptions are options for starting up.
type StartOptions struct {
	KbfsParams libkbfs.InitParams
	// Remote is the name that the caller's repo (on local disk) has
	// assigned to the KBFS-based repo.
	Remote string
	// Repo is the URL the caller's repo (on local disk) is trying to
	// access, in the form "keybase://private/user/reponame".
	Repo string
	// GitDir is the filepath leading to the .git directory of the
	// caller's local on-disk repo.
	GitDir string
}

const (
	// Debug tag ID for a whole remote helper process.
	ctxProcessOpID = "GITID"
)

type ctxProcessTagKey int

const (
	ctxProcessIDKey ctxProcessTagKey = iota
)

// Start starts the kbfsgit logic, and begins listening for git
// commands from `input` and responding to them via `output`.
func Start(ctx context.Context, options StartOptions,
	kbCtx libkbfs.Context, defaultLogPath string,
	input io.Reader, output io.Writer) *libfs.Error {
	log, err := libkbfs.InitLogWithPrefix(
		options.KbfsParams, kbCtx, "git", defaultLogPath)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	// Assign a unique ID to each remote-helper instance, since
	// they'll all share the same log.
	ctx, err = libkbfs.NewContextWithCancellationDelayer(
		libkbfs.CtxWithRandomIDReplayable(
			ctx, ctxProcessIDKey, ctxProcessOpID, log))
	if err != nil {
		return libfs.InitError(err.Error())
	}
	log.CDebugf(
		ctx, "Running Git remote helper: remote=%s, repo=%s, storageRoot=%s",
		options.Remote, options.Repo, options.KbfsParams.StorageRoot)

	config, err := libkbfs.InitWithLogPrefix(
		ctx, kbCtx, options.KbfsParams, nil, nil, log, "git")
	if err != nil {
		return libfs.InitError(err.Error())
	}
	defer config.Shutdown(ctx)

	r, err := newRunner(
		ctx, config, options.Remote, options.Repo, options.GitDir,
		input, output)
	if err != nil {
		return libfs.InitError(err.Error())
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- r.processCommands(ctx)
	}()

	select {
	case err := <-errCh:
		if err != nil {
			return libfs.InitError(err.Error())
		}
		return nil
	case <-ctx.Done():
		return libfs.InitError(ctx.Err().Error())
	}
}

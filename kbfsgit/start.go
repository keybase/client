// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"bufio"
	"context"
	"io"
	"strings"

	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/pkg/errors"
)

// StartOptions are options for starting up.
type StartOptions struct {
	KbfsParams libkbfs.InitParams
	Remote     string
	Repo       string
}

const (
	gitCmdCapabilities = "capabilities"

	// Debug tag ID for a whole remote helper process.
	ctxProcessOpID = "GITID"
	// Debug tag ID for an individual git command passed to the process.
	ctxCommandOpID = "GITCMDID"
)

// CtxTagKey is the type used for unique context tags
type ctxTagKey int

const (
	ctxProcessIDKey ctxTagKey = iota
	ctxCommandIDKey
)

func handleGitCommand(ctx context.Context, line string) error {
	return nil
}

func processCommands(ctx context.Context, config libkbfs.Config,
	input io.Reader, output io.Writer) error {
	log := config.MakeLogger("")
	log.CDebugf(ctx, "Ready to process")
	reader := bufio.NewReader(input)
	for {
		cmd, err := reader.ReadString('\n')
		if err != nil {
			return err
		}
		cmdParts := strings.Fields(cmd)
		if len(cmdParts) == 0 {
			log.CDebugf(ctx, "Done processing commands")
			return nil
		}

		ctx := libkbfs.CtxWithRandomIDReplayable(
			ctx, ctxCommandIDKey, ctxCommandOpID, log)
		log.CDebugf(ctx, "Received command: %s", cmd)

		switch cmdParts[0] {
		case gitCmdCapabilities:
			output.Write([]byte("\n\n"))
		default:
			return errors.Errorf("Unsupported command: %s", cmdParts[0])
		}
	}
}

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
	ctx = libkbfs.CtxWithRandomIDReplayable(
		ctx, ctxProcessIDKey, ctxProcessOpID, log)
	log.CDebugf(
		ctx, "Running Git remote helper: remote=%s, repo=%s, storageRoot=%s",
		options.Remote, options.Repo, options.KbfsParams.StorageRoot)

	config, err := libkbfs.InitWithLogPrefix(
		ctx, kbCtx, options.KbfsParams, nil, nil, log, "git")
	if err != nil {
		return libfs.InitError(err.Error())
	}
	defer config.Shutdown(ctx)

	errCh := make(chan error, 1)
	go func() {
		errCh <- processCommands(ctx, config, input, output)
	}()

	select {
	case err := <-errCh:
		return libfs.InitError(err.Error())
	case <-ctx.Done():
		return libfs.InitError(ctx.Err().Error())
	}
}

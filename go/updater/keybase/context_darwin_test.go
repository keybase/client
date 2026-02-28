// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin
// +build darwin

package keybase

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/command"
	"github.com/stretchr/testify/require"
)

type testConfigPausedPrompt struct {
	config
	inUse bool
	force bool
}

func (c testConfigPausedPrompt) promptProgram() (command.Program, error) {
	if c.force {
		return command.Program{
			Path: filepath.Join(os.Getenv("GOPATH"), "bin", "test"),
			Args: []string{"echo", `{"button": "Force update"}`},
		}, nil
	}
	return command.Program{
		Path: filepath.Join(os.Getenv("GOPATH"), "bin", "test"),
		Args: []string{"echo", `{"button": "Try again later"}`},
	}, nil
}

func (c testConfigPausedPrompt) keybasePath() string {
	_, filename, _, _ := runtime.Caller(0)
	if c.inUse {
		return filepath.Join(filepath.Dir(filename), "../test/keybase-check-in-use-true.sh")
	}
	return filepath.Join(filepath.Dir(filename), "../test/keybase-check-in-use-false.sh")
}

func (c testConfigPausedPrompt) updaterOptions() updater.UpdateOptions {
	return updater.UpdateOptions{}
}

func (c testConfigPausedPrompt) destinationPath() string {
	return "/Applications/Test.app"
}

func TestContextCheckInUse(t *testing.T) {
	// In use, force
	ctx := newContext(&testConfigPausedPrompt{inUse: true, force: true}, testLog)
	err := ctx.BeforeApply(updater.Update{})
	require.NoError(t, err)

	// Not in use
	ctx = newContext(&testConfigPausedPrompt{inUse: false}, testLog)
	err = ctx.BeforeApply(updater.Update{})
	require.NoError(t, err)

	// In use, user cancels
	ctx = newContext(&testConfigPausedPrompt{inUse: true, force: false}, testLog)
	err = ctx.BeforeApply(updater.Update{})
	require.EqualError(t, err, "Canceled by user from paused prompt")
}

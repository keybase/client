// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/command"
	"github.com/stretchr/testify/assert"
)

func testPromptWithProgram(t *testing.T, promptProgram command.Program, timeout time.Duration) (*updater.UpdatePromptResponse, error) {
	cfg, _ := testConfig(t)
	ctx := newContext(cfg, testLog)
	assert.NotNil(t, ctx)

	update := updater.Update{
		Version:     "1.2.3-400+sha",
		Name:        "Test",
		Description: "Bug fixes",
	}

	updaterOptions := cfg.updaterOptions()

	promptOptions := updater.UpdatePromptOptions{AutoUpdate: false}
	return ctx.updatePrompt(promptProgram, update, updaterOptions, promptOptions, timeout)
}

func TestPromptTimeout(t *testing.T) {
	promptProgram := command.Program{
		Path: filepath.Join(os.Getenv("GOPATH"), "bin", "test"),
		Args: []string{"sleep"},
	}
	resp, err := testPromptWithProgram(t, promptProgram, 10*time.Millisecond)
	assert.Error(t, err)
	assert.Nil(t, resp)
}

func TestPromptInvalidResponse(t *testing.T) {
	promptProgram := command.Program{
		Path: filepath.Join(os.Getenv("GOPATH"), "bin", "test"),
		Args: []string{"echo", `{invalid}`},
	}
	resp, err := testPromptWithProgram(t, promptProgram, time.Second)
	assert.Error(t, err)
	assert.Nil(t, resp)
}

func TestPromptApply(t *testing.T) {
	promptProgram := command.Program{
		Path: filepath.Join(os.Getenv("GOPATH"), "bin", "test"),
		Args: []string{"echo", `{
  		"action": "apply",
  		"autoUpdate": true
		}`},
	}
	resp, err := testPromptWithProgram(t, promptProgram, time.Second)
	assert.NoError(t, err)
	if assert.NotNil(t, resp) {
		assert.True(t, resp.AutoUpdate)
		assert.Equal(t, updater.UpdateActionApply, resp.Action)
	}
}

func TestPromptSnooze(t *testing.T) {
	promptProgram := command.Program{
		Path: filepath.Join(os.Getenv("GOPATH"), "bin", "test"),
		Args: []string{"echo", `{
  		"action": "snooze",
  		"autoUpdate": true
		}`},
	}
	resp, err := testPromptWithProgram(t, promptProgram, time.Second)
	assert.NoError(t, err)
	if assert.NotNil(t, resp) {
		assert.False(t, resp.AutoUpdate)
		assert.Equal(t, updater.UpdateActionSnooze, resp.Action)
	}
}

func TestPromptCancel(t *testing.T) {
	promptProgram := command.Program{
		Path: filepath.Join(os.Getenv("GOPATH"), "bin", "test"),
		Args: []string{"echo", `{
  		"action": "cancel",
  		"autoUpdate": true
		}`},
	}
	resp, err := testPromptWithProgram(t, promptProgram, time.Second)
	assert.NoError(t, err)
	if assert.NotNil(t, resp) {
		assert.False(t, resp.AutoUpdate)
		assert.Equal(t, updater.UpdateActionCancel, resp.Action)
	}
}

func TestPromptNoOutput(t *testing.T) {
	promptProgram := command.Program{
		Path: filepath.Join(os.Getenv("GOPATH"), "bin", "test"),
		Args: []string{"echo"},
	}
	resp, err := testPromptWithProgram(t, promptProgram, time.Second)
	assert.NoError(t, err)
	if assert.NotNil(t, resp) {
		assert.False(t, resp.AutoUpdate)
		assert.Equal(t, updater.UpdateActionCancel, resp.Action)
	}
}

func TestPromptError(t *testing.T) {
	promptProgram := command.Program{
		Path: filepath.Join(os.Getenv("GOPATH"), "bin", "test"),
		Args: []string{"err"},
	}
	cancel, err := testPausedPromptWithProgram(t, promptProgram, time.Second)
	assert.Error(t, err)
	assert.False(t, cancel)
}

func testPausedPromptWithProgram(t *testing.T, promptProgram command.Program, timeout time.Duration) (bool, error) {
	cfg, _ := testConfig(t)
	ctx := newContext(cfg, testLog)
	assert.NotNil(t, ctx)
	return ctx.pausedPrompt(promptProgram, timeout)
}

func TestPausedPromptForce(t *testing.T) {
	promptProgram := command.Program{
		Path: filepath.Join(os.Getenv("GOPATH"), "bin", "test"),
		Args: []string{"echo", `{"button": "Force update"}`},
	}
	cancel, err := testPausedPromptWithProgram(t, promptProgram, time.Second)
	assert.NoError(t, err)
	assert.False(t, cancel)
}

func TestPausedPromptCancel(t *testing.T) {
	promptProgram := command.Program{
		Path: filepath.Join(os.Getenv("GOPATH"), "bin", "test"),
		Args: []string{"echo", `{"button": "Try again later"}`},
	}
	cancel, err := testPausedPromptWithProgram(t, promptProgram, time.Second)
	assert.NoError(t, err)
	assert.True(t, cancel)
}

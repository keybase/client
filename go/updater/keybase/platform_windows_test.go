// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build windows
// +build windows

package keybase

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdatePrompt(t *testing.T) {
	outPath := util.TempPath("", "TestUpdatePrompt.")
	defer util.RemoveFileAtPath(outPath)
	promptOptions := updater.UpdatePromptOptions{OutPath: outPath}
	out := `{"action":"apply","autoUpdate":true}` + "\n"

	programPath := filepath.Join(os.Getenv("GOPATH"), "bin", "test.exe")
	args := []string{
		fmt.Sprintf("-out=%s", out),
		fmt.Sprintf("-outPath=%s", outPath),
		"writeToFile"}
	ctx := newContext(&testConfigPlatform{ProgramPath: programPath, Args: args}, testLog)
	resp, err := ctx.UpdatePrompt(testUpdate, testOptions, promptOptions)
	require.NoError(t, err)
	assert.Equal(t, &updater.UpdatePromptResponse{Action: updater.UpdateActionApply, AutoUpdate: true}, resp)
}

func TestApplyNoAsset(t *testing.T) {
	ctx := newContext(&testConfigPlatform{}, testLog)
	tmpDir, err := util.MakeTempDir("TestApplyNoAsset.", 0700)
	defer util.RemoveFileAtPath(tmpDir)
	require.NoError(t, err)
	err = ctx.Apply(testUpdate, testOptions, tmpDir)
	require.EqualError(t, err, "No asset")
}

func TestApplyAsset(t *testing.T) {
	t.Skip() // was flaking
	ctx := newContext(&testConfigPlatform{}, testLog)
	tmpDir, err := util.MakeTempDir("TestApplyAsset.", 0700)
	defer util.RemoveFileAtPath(tmpDir)
	require.NoError(t, err)

	exePath := filepath.Join(os.Getenv("GOPATH"), "bin", "test.exe")
	localPath := filepath.Join(tmpDir, "test.exe")
	err = util.CopyFile(exePath, localPath, testLog)
	require.NoError(t, err)

	update := updater.Update{
		Asset: &updater.Asset{
			LocalPath: exePath,
		},
	}

	err = ctx.Apply(update, updater.UpdateOptions{}, tmpDir)
	require.NoError(t, err)
}

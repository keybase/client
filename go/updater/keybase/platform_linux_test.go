// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build linux
// +build linux

package keybase

import (
	"testing"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBeforeUpdatePrompt(t *testing.T) {
	ctx := newContext(&testConfigPlatform{}, testLog)
	err := ctx.BeforeUpdatePrompt(testUpdate, testOptions)
	assert.EqualError(t, err, "Update Error (cancel): Linux uses system package manager")
}

func TestUpdatePrompt(t *testing.T) {
	ctx := newContext(&testConfigPlatform{}, testLog)
	resp, err := ctx.UpdatePrompt(testUpdate, testOptions, updater.UpdatePromptOptions{})
	assert.Equal(t, &updater.UpdatePromptResponse{Action: updater.UpdateActionContinue}, resp)
	require.NoError(t, err)
}

func TestPausedPrompt(t *testing.T) {
	ctx := newContext(&testConfigPlatform{}, testLog)
	cancel := ctx.PausedPrompt()
	assert.False(t, cancel)
}

func TestApplyNoAsset(t *testing.T) {
	ctx := newContext(&testConfigPlatform{}, testLog)
	tmpDir, err := util.MakeTempDir("TestApplyNoAsset.", 0700)
	defer util.RemoveFileAtPath(tmpDir)
	require.NoError(t, err)
	err = ctx.Apply(testUpdate, testOptions, tmpDir)
	require.NoError(t, err)
}

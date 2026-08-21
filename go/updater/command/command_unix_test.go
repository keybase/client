// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build linux || darwin

package command

import (
	"os/exec"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExecWithEnv(t *testing.T) {
	result, err := execWithFunc("printenv", []string{"TESTENV"}, []string{"TESTENV=ok"}, exec.Command, time.Second, testLog)
	require.NoError(t, err)
	assert.Equal(t, "ok\n", result.Stdout.String())
}

func TestExecWithNoEnv(t *testing.T) {
	// Check there is a PATH env var if we pass nil
	result, err := execWithFunc("printenv", []string{"PATH"}, nil, exec.Command, time.Second, testLog)
	require.NoError(t, err)
	assert.NotEmpty(t, result.Stdout.String())
}

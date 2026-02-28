// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build linux || darwin
// +build linux darwin

package command

import (
	"os/exec"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestExecWithEnv(t *testing.T) {
	result, err := execWithFunc("printenv", []string{"TESTENV"}, []string{"TESTENV=ok"}, exec.Command, time.Second, testLog)
	assert.NoError(t, err)
	assert.Equal(t, result.Stdout.String(), "ok\n")
}

func TestExecWithNoEnv(t *testing.T) {
	// Check there is a PATH env var if we pass nil
	result, err := execWithFunc("printenv", []string{"PATH"}, nil, exec.Command, time.Second, testLog)
	assert.NoError(t, err)
	assert.NotEqual(t, result.Stdout.String(), "")
}

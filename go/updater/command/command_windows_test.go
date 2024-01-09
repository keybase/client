// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build windows
// +build windows

package command

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestExecEchoWindows(t *testing.T) {
	result, err := Exec("cmd", []string{"/c", "echo", "arg1", "arg2"}, time.Second, testLog)
	assert.NoError(t, err)
	assert.Equal(t, strings.TrimSpace(result.Stdout.String()), "arg1 arg2")
}

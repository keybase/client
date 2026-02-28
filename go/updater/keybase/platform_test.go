// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"os"
	"path/filepath"

	"github.com/keybase/client/go/updater/command"
)

type testConfigPlatform struct {
	config
	ProgramPath string
	Args        []string
}

func (c testConfigPlatform) promptProgram() (command.Program, error) {
	programPath, args := c.ProgramPath, c.Args
	if programPath == "" {
		programPath = filepath.Join(os.Getenv("GOPATH"), "bin", "test")
	}

	return command.Program{
		Path: programPath,
		Args: args,
	}, nil
}

func (c testConfigPlatform) notifyProgram() string {
	return "echo"
}

func (c testConfigPlatform) keybasePath() string {
	return filepath.Join(os.Getenv("GOPATH"), "bin", "test")
}

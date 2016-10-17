// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package client

import (
	"github.com/keybase/go-updater/watchdog"
)

func getkbfsProgram(g *GlobalContext, kbfsPath string) (watchdog.Program, err) {

	mountDir, err := g.env.GetMountDir()
	if err != nil {
		return nil, err
	}

	return watchdog.ProgramNormal{
		Path: kbfsPath,
		Args: []string{
			"-debug",
			"-log-to-file",
			mountDir,
		},
		ExitOn: watchdog.ExitOnSuccess,
	}, nil
}

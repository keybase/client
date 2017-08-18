// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin,!windows

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func getPlatformSpecificCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	return []cli.Command{}
}

func StopLaunchdService(g *libkb.GlobalContext, label string, wait bool) error {
	return fmt.Errorf("Unsupported on this platform")
}

func restartLaunchdService(g *libkb.GlobalContext, label string, serviceInfoPath string) error {
	return fmt.Errorf("Unsupported on this platform")
}

// DebugSocketError allows platforms to help the user diagnose and resolve
// socket errors.
func DiagnoseSocketError(ui libkb.UI, err error) {}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
)

func getPlatformSpecificCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	return []cli.Command{}
}

const defaultForkType = keybase1.ForkType_AUTO

func StartLaunchdService(g *libkb.GlobalContext, label string, wait bool) error {
	return fmt.Errorf("Unsupported on this platform")
}

func StopLaunchdService(g *libkb.GlobalContext, label string, wait bool) error {
	return fmt.Errorf("Unsupported on this platform")
}

func RestartLaunchdService(g *libkb.GlobalContext, label string) error {
	return fmt.Errorf("Unsupported on this platform")
}

// DebugSocketError allows platforms to help the user diagnose and resolve
// socket errors.
func DiagnoseSocketError(ui libkb.UI, err error) {}

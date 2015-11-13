// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

// this is the list of additional commands for the windows version of the
// client.
package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func addPlatformCtlSubs(commands []cli.Command, cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	return append(commands, NewCmdWatchdog(cl, g))
}

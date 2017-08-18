// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build production

// this is the list of commands for the release version of the
// client.
package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func getBuildSpecificCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	return []cli.Command{}
}

const develUsage = false

var restrictedSignupFlags = []cli.Flag{}
var restrictedProveFlags = []cli.Flag{}

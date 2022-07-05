// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdCtl(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	commands := []cli.Command{
		NewCmdCtlStart(cl, g),
		NewCmdCtlStop(cl, g),
		NewCmdCtlReload(cl, g),
		NewCmdCtlRestart(cl, g),
		NewCmdCtlLogRotate(cl, g),
		NewCmdWatchdog(cl, g),
		NewCmdCtlAppExit(cl, g),
		NewCmdWait(cl, g),
	}

	commands = append(commands, platformSpecificCtlCommands(cl, g)...)

	return cli.Command{
		Name:        "ctl",
		Usage:       "Control the background keybase service",
		Subcommands: commands,
	}
}

// availableComponents specify which components can be included or excluded
var availableCtlComponents = []string{ //nolint
	install.ComponentNameApp.String(),
	install.ComponentNameService.String(),
	install.ComponentNameKBFS.String(),
	install.ComponentNameUpdater.String(),
}

// defaultCtlComponents return default components (map)
func defaultCtlComponents(enable bool) map[string]bool { //nolint
	components := map[string]bool{}
	for _, c := range availableCtlComponents {
		components[c] = enable
	}
	return components
}

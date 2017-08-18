// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func NewCmdCtl(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {

	return cli.Command{
		Name:  "ctl",
		Usage: "Control the background keybase service",
		Subcommands: []cli.Command{
			NewCmdCtlStart(cl, g),
			NewCmdCtlStop(cl, g),
			NewCmdCtlReload(cl, g),
			NewCmdCtlRestart(cl, g),
			NewCmdCtlLogRotate(cl, g),
			NewCmdWatchdog(cl, g),
			NewCmdWatchdog2(cl, g),
			NewCmdCtlAppExit(cl, g),
		},
	}
}

// availableComponents specify which components can be included or excluded
var availableCtlComponents = []string{
	install.ComponentNameApp.String(),
	install.ComponentNameService.String(),
	install.ComponentNameKBFS.String(),
	install.ComponentNameUpdater.String(),
}

// defaultCtlComponents return default components (map)
func defaultCtlComponents(enable bool) map[string]bool {
	components := map[string]bool{}
	for _, c := range availableCtlComponents {
		components[c] = enable
	}
	return components
}

// ctlParseArgv returns map with include/exclude components
func ctlParseArgv(ctx *cli.Context) map[string]bool {
	components := defaultCtlComponents(true)
	if ctx.String("exclude") != "" {
		excluded := strings.Split(ctx.String("exclude"), ",")
		for _, exclude := range excluded {
			components[exclude] = false
		}
	}
	if ctx.String("include") != "" {
		included := strings.Split(ctx.String("include"), ",")
		components = defaultCtlComponents(false)
		for _, include := range included {
			components[include] = true
		}
	}
	return components
}

// CtlServiceStop will stop a running service via RPC call
func CtlServiceStop(g *libkb.GlobalContext) error {
	cli, err := GetCtlClient(g)
	if err != nil {
		return err
	}
	return cli.Stop(context.TODO(), keybase1.StopArg{ExitCode: keybase1.ExitCode_OK})
}

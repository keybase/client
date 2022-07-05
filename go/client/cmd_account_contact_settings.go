// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdAccountContactSettings(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	subcommands := []cli.Command{
		newCmdAccountContactSettingsAPI(cl, g),
	}
	return cli.Command{
		Name:         "contact-settings",
		Usage:        "Manage contact privacy settings",
		ArgumentHelp: "[arguments...]",
		Subcommands:  subcommands,
	}
}

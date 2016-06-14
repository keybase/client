// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// +build production

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// These are the production rekey commands
func NewCmdRekey(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "rekey",
		Usage:        "Rekey status and actions",
		ArgumentHelp: "[status]", // the CLI command to enter paper key for rekey might go here
		Subcommands: []cli.Command{
			NewCmdRekeyStatus(cl, g),
		},
	}
}

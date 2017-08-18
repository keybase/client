// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdSigs(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "sigs",
		ArgumentHelp: "[arguments...]",
		Usage:        "Manage signatures",
		Subcommands: []cli.Command{
			NewCmdSigsList(cl, g),
			NewCmdSigsRevoke(cl, g),
		},
	}
}

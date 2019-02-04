// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// NewCmdSimpleFSSync creates the sync command, which is just a holder
// for subcommands.
func NewCmdSimpleFSSync(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "sync",
		Usage: "Manages the per-folder syncing state",
		Subcommands: append([]cli.Command{
			NewCmdSimpleFSSyncEnable(cl, g),
			NewCmdSimpleFSSyncDisable(cl, g),
			NewCmdSimpleFSSyncShow(cl, g),
		}),
	}
}

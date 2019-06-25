// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// NewCmdSimpleFSDebug creates the debug command, which is just a
// holder for subcommands.
func NewCmdSimpleFSDebug(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "debug",
		Usage: "Debug utilities",
		Subcommands: append([]cli.Command{
			NewCmdSimpleFSDebugDump(cl, g),
			NewCmdSimpleFSDebugObfuscate(cl, g),
			NewCmdSimpleFSDebugDeobfuscate(cl, g),
		}),
	}
}

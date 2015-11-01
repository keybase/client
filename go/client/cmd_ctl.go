// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
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
		},
	}
}

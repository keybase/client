// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

// this is the list of commands for the devel version of the
// client.
package client

import (
	"github.com/keybase/cli"
)

func cmdIDAddFlags(cmd *cli.Command) {
	cmd.Flags = append(cmd.Flags, cli.BoolFlag{
		Name:  "delegate-identify-ui",
		Usage: "Delegate our identify UI to another process",
	})
}

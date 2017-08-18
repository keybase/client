// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdPassphrase(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "passphrase",
		Usage: "Change or recover your keybase passphrase",
		Subcommands: []cli.Command{
			NewCmdPassphraseChange(cl, g),
			NewCmdPassphraseRecover(cl, g),
		},
	}
}

// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdEmail(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "email",
		Usage: "Manage your emails",
		Subcommands: []cli.Command{
			NewCmdAddEmail(cl, g),
			NewCmdEditEmail(cl, g),
			NewCmdDeleteEmail(cl, g),
			NewCmdListEmails(cl, g),
			NewCmdSetVisibilityEmail(cl, g),
			NewCmdSetPrimaryEmail(cl, g),
			NewCmdSendVerificationEmail(cl, g),
		},
	}
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
)

// compatibility with node client commands:

func NewCmdCompatSign(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name: "sign",
		Action: func(c *cli.Context) {
			GlobUI.Println("Use `keybase pgp sign` instead.")
		},
		Description: "Use `keybase pgp sign` instead.",
	}
}

func NewCmdCompatVerify(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name: "verify",
		Action: func(c *cli.Context) {
			GlobUI.Println("Use `keybase pgp verify` instead.")
		},
		Description: "Use `keybase pgp verify` instead.",
	}
}

func NewCmdCompatDir(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name: "dir",
		Action: func(c *cli.Context) {
			GlobUI.Println("`keybase dir` has been deprecated.")
		},
		Description: "`keybase dir` has been deprecated.",
	}
}

func NewCmdCompatPush(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name: "push",
		Action: func(c *cli.Context) {
			GlobUI.Println("Use `keybase pgp select` instead.")
		},
		Description: "Use `keybase pgp select` instead.",
	}
}

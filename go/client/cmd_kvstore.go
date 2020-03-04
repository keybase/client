// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdKVStore(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	subcommands := []cli.Command{
		newCmdKVStoreAPI(cl, g),
	}
	return cli.Command{
		Name:         "kvstore",
		Usage:        "Manage a simple cleartext key to encrypted value store",
		ArgumentHelp: "[arguments...]",
		Subcommands:  subcommands,
	}
}

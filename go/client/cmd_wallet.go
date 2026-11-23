package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func newCmdWallet(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "wallet",
		Usage:        "Export Stellar account secret keys",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			newCmdWalletExport(cl, g),
		},
	}
}

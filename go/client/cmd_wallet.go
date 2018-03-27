package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func newCmdWallet(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	subcommands := []cli.Command{
		newCmdWalletBalances(cl, g),
	}
	subcommands = append(subcommands, getBuildSpecificWalletCommands(cl, g)...)
	return cli.Command{
		Name:        "wallet",
		Subcommands: subcommands,
	}
}

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func newCmdWallet(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	subcommands := []cli.Command{
		newCmdWalletBalances(cl, g),
		newCmdWalletCancel(cl, g),
		newCmdWalletExport(cl, g),
		newCmdWalletDetail(cl, g),
		newCmdWalletHistory(cl, g),
		newCmdWalletImport(cl, g),
		newCmdWalletSend(cl, g),
		newCmdWalletSetCurrency(cl, g),
		newCmdWalletSetPrimary(cl, g),
	}
	if g.Env.GetFeatureFlags().Admin() {
		subcommands = append(subcommands, newCmdWalletFixup(cl, g))
	}
	subcommands = append(subcommands, getBuildSpecificWalletCommands(cl, g)...)
	return cli.Command{
		Name:        "wallet",
		Subcommands: subcommands,
	}
}

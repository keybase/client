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
		newCmdWalletCancelRequest(cl, g),
		newCmdWalletDetail(cl, g),
		newCmdWalletExport(cl, g),
		newCmdWalletGetStarted(cl, g),
		newCmdWalletHistory(cl, g),
		newCmdWalletImport(cl, g),
		newCmdWalletLookup(cl, g),
		newCmdWalletRename(cl, g),
		newCmdWalletRequest(cl, g),
		newCmdWalletSend(cl, g),
		newCmdWalletSetCurrency(cl, g),
		newCmdWalletSetMobileOnly(cl, g),
		newCmdWalletSetPrimary(cl, g),
		newCmdWalletSetInflation(cl, g),
		newCmdWalletGetInflation(cl, g),
	}
	subcommands = append(subcommands, getBuildSpecificWalletCommands(cl, g)...)
	return cli.Command{
		Name:        "wallet",
		Subcommands: subcommands,
	}
}

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func newCmdWallet(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	// please keep sorted
	subcommands := []cli.Command{
		newCmdWalletAddTrustline(cl, g),
		newCmdWalletAPI(cl, g),
		newCmdWalletAssetSearch(cl, g),
		newCmdWalletBalances(cl, g),
		newCmdWalletCancel(cl, g),
		newCmdWalletCancelRequest(cl, g),
		newCmdWalletChangeTrustlineLimit(cl, g),
		newCmdWalletDeleteTrustline(cl, g),
		newCmdWalletDetail(cl, g),
		newCmdWalletExport(cl, g),
		newCmdWalletGetInflation(cl, g),
		newCmdWalletGetStarted(cl, g),
		newCmdWalletHistory(cl, g),
		newCmdWalletImport(cl, g),
		newCmdWalletLookup(cl, g),
		newCmdWalletPopularAssets(cl, g),
		newCmdWalletRename(cl, g),
		newCmdWalletRequest(cl, g),
		newCmdWalletSend(cl, g),
		newCmdWalletSendPathPayment(cl, g),
		newCmdWalletSetCurrency(cl, g),
		newCmdWalletSetInflation(cl, g),
		newCmdWalletSetMobileOnly(cl, g),
		newCmdWalletSetPrimary(cl, g),
		newCmdWalletSign(cl, g),
	}
	subcommands = append(subcommands, getBuildSpecificWalletCommands(cl, g)...)
	return cli.Command{
		Name:         "wallet",
		Usage:        "Send and receive Stellar XLM",
		ArgumentHelp: "[arguments...]",
		Subcommands:  subcommands,
	}
}

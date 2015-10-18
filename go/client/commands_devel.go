// +build !production

// this is the list of commands for the devel version of the
// client.
package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func GetCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	return []cli.Command{
		NewCmdBTC(cl),
		NewCmdCert(cl),
		NewCmdCompatDecrypt(cl),
		NewCmdCompatDir(cl),
		NewCmdCompatEncrypt(cl),
		NewCmdCompatPush(cl),
		NewCmdCompatSign(cl),
		NewCmdCompatVerify(cl),
		NewCmdConfig(cl),
		NewCmdCtl(cl, g),
		NewCmdDb(cl, g),
		NewCmdDevice(cl),
		NewCmdDoctor(cl),
		NewCmdFavorite(cl),
		NewCmdID(cl),
		NewCmdLaunchd(cl),
		NewCmdListTracking(cl),
		NewCmdListTrackers(cl),
		NewCmdLogin(cl),
		NewCmdLogout(cl),
		NewCmdPaperKey(cl),
		NewCmdPassphrase(cl),
		NewCmdPGP(cl),
		NewCmdPing(cl),
		NewCmdProve(cl),
		NewCmdReset(cl),
		NewCmdRevoke(cl),
		NewCmdSearch(cl),
		NewCmdSigs(cl),
		NewCmdSignup(cl),
		NewCmdStatus(cl),
		NewCmdStress(cl),
		NewCmdTrack(cl),
		NewCmdUnlock(cl),
		NewCmdUntrack(cl),
		NewCmdVersion(cl),
	}
}

var extraSignupFlags = []cli.Flag{
	cli.StringFlag{
		Name:  "p, passphrase",
		Usage: "Specify a passphrase",
	},
	cli.StringFlag{
		Name:  "d, device",
		Usage: "Specify a device name",
	},
	cli.BoolFlag{
		Name:  "b, batch",
		Usage: "Batch mode (don't prompt, use all defaults)",
	},
	cli.BoolFlag{
		Name:  "devel",
		Usage: "run the client in development mode",
	},
}

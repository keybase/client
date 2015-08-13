// +build !release

// this is the list of commands for the devel version of the
// client.
package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
)

func GetCommands(cl *libcmdline.CommandLine) []cli.Command {
	return []cli.Command{
		NewCmdBackup(cl),
		NewCmdBTC(&CmdBTC{}, cl),
		NewCmdCert(cl),
		NewCmdConfig(cl),
		NewCmdCtl(cl),
		NewCmdDb(cl),
		NewCmdDevice(cl),
		NewCmdDoctor(&CmdDoctor{}, cl),
		NewCmdFavorite(cl),
		NewCmdID(cl),
		NewCmdList(cl),
		NewCmdLogin(cl),
		NewCmdLogout(cl),
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
		NewCmdUntrack(cl),
		NewCmdVersion(cl),
	}
}

var extraSignupFlags = []cli.Flag{
	cli.StringFlag{
		Name:  "u, username",
		Usage: "Specify a username",
	},
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

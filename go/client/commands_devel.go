// +build !release

// this is the list of commands for the devel version of the
// client.
package client

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
)

func GetCommands(cl *libcmdline.CommandLine) []cli.Command {
	return []cli.Command{
		NewCmdBTC(cl),
		NewCmdCert(cl),
		NewCmdConfig(cl),
		NewCmdCtl(cl),
		NewCmdDb(cl),
		NewCmdDevice(cl),
		NewCmdDoctor(cl),
		NewCmdId(cl),
		NewCmdList(cl),
		NewCmdLogin(cl),
		NewCmdLogout(cl),
		NewCmdMykey(cl),
		NewCmdPGP(cl),
		NewCmdPing(cl),
		NewCmdProve(cl),
		NewCmdReset(cl),
		NewCmdResolve(cl),
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
}

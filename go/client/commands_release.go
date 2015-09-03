// +build release

// this is the list of commands for the release version of the
// client.
package client

import (
	"github.com/keybase/cli"
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
		NewCmdID(cl),
		NewCmdLaunchd(cl),
		NewCmdList(cl),
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
		NewCmdTrack(cl),
		NewCmdUntrack(cl),
		NewCmdVersion(cl),
	}
}

var extraSignupFlags = []cli.Flag{}

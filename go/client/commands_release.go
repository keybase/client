// +build release

// this is the list of commands for the release version of the
// client.
package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
)

func cmdline() *libcmdline.CommandLine {
	cl := libcmdline.NewCommandLine(true)
	cmds := []cli.Command{
		NewCmdBTC(cl),
		NewCmdCert(cl),
		NewCmdConfig(cl),
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
		NewCmdTrack(cl),
		NewCmdUntrack(cl),
		NewCmdVersion(cl),
	}
	cl.AddCommands(cmds)

	return cl
}

var extraSignupFlags = []cli.Flag{}

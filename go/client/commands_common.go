// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// this is the list of commands for all versions of the client.
package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func GetCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	ret := []cli.Command{
		NewCmdBTC(cl, g),
		NewCmdCA(cl, g),
		NewCmdCert(cl),
		NewCmdCompatDir(cl),
		NewCmdCompatPush(cl),
		NewCmdCompatSign(cl),
		NewCmdCompatVerify(cl),
		NewCmdConfig(cl),
		NewCmdCtl(cl, g),
		NewCmdDb(cl, g),
		NewCmdDeprovision(cl, g),
		NewCmdDevice(cl, g),
		NewCmdExp(cl, g),
		NewCmdID(cl, g),
		NewCmdListTracking(cl),
		NewCmdListTrackers(cl),
		NewCmdLogin(cl, g),
		NewCmdLogout(cl, g),
		NewCmdPaperKey(cl),
		NewCmdPassphrase(cl),
		NewCmdPGP(cl, g),
		NewCmdPing(cl),
		NewCmdProve(cl),
		NewCmdSearch(cl),
		NewCmdSigs(cl),
		NewCmdSignup(cl, g),
		NewCmdStatus(cl),
		NewCmdTrack(cl),
		NewCmdUnlock(cl),
		NewCmdUntrack(cl),
		NewCmdVersion(cl, g),
	}
	ret = append(ret, getBuildSpecificCommands(cl, g)...)
	ret = append(ret, getPlatformSpecificCommands(cl, g)...)
	return ret
}

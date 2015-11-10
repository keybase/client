// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build production

// this is the list of commands for the release version of the
// client.
package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func GetCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	return []cli.Command{
		NewCmdBTC(cl, g),
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
		NewCmdDevice(cl, g),
		NewCmdID(cl, g),
		NewCmdLaunchd(cl, g),
		NewCmdListTracking(cl),
		NewCmdListTrackers(cl),
		NewCmdLogin(cl, g),
		NewCmdLogout(cl, g),
		NewCmdPaperKey(cl),
		NewCmdPassphrase(cl),
		NewCmdPGP(cl, g),
		NewCmdPing(cl),
		NewCmdProve(cl),
		NewCmdReset(cl),
		NewCmdSearch(cl),
		NewCmdSigs(cl),
		NewCmdSignup(cl, g),
		NewCmdStatus(cl),
		NewCmdTrack(cl),
		NewCmdUnlock(cl),
		NewCmdUntrack(cl),
		NewCmdVersion(cl, g),
	}
}

var extraSignupFlags = []cli.Flag{}

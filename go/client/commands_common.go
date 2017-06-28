// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// this is the list of commands for all versions of the client.
package client

import (
	"sort"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func GetCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	ret := []cli.Command{
		NewCmdBase62(cl, g),
		NewCmdBTC(cl, g),
		NewCmdCA(cl, g),
		NewCmdCert(cl),
		NewCmdChat(cl, g),
		NewCmdCompatDir(cl),
		NewCmdCompatPush(cl),
		NewCmdConfig(cl, g),
		NewCmdCtl(cl, g),
		NewCmdCurrency(cl, g),
		NewCmdDb(cl, g),
		NewCmdDecrypt(cl, g),
		NewCmdDeprovision(cl, g),
		NewCmdDevice(cl, g),
		NewCmdDismiss(cl, g),
		NewCmdDumpKeyfamily(cl, g),
		NewCmdDumpPushNotifications(cl, g),
		NewCmdEncrypt(cl, g),
		NewCmdID(cl, g),
		NewCmdInterestingPeople(cl, g),
		NewCmdListTracking(cl, g),
		NewCmdListTrackers(cl, g),
		NewCmdLog(cl, g),
		NewCmdLogin(cl, g),
		NewCmdLogout(cl, g),
		NewCmdPaperKey(cl, g),
		NewCmdPassphrase(cl, g),
		NewCmdPGP(cl, g),
		NewCmdPing(cl, g),
		NewCmdProve(cl, g),
		NewCmdRekey(cl, g),
		NewCmdSearch(cl, g),
		NewCmdSign(cl, g),
		NewCmdSigs(cl, g),
		NewCmdSignup(cl, g),
		NewCmdSimpleFS(cl, g),
		NewCmdStatus(cl, g),
		NewCmdTrack(cl, g),
		NewCmdUnlock(cl),
		NewCmdUntrack(cl, g),
		NewCmdUpdate(cl, g),
		NewCmdVerify(cl, g),
		NewCmdVersion(cl, g),
	}
	ret = append(ret, getBuildSpecificCommands(cl, g)...)
	ret = append(ret, getPlatformSpecificCommands(cl, g)...)

	sort.Sort(cli.ByName(ret))
	return ret
}

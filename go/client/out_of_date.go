// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"github.com/keybase/client/go/libkb"
	context "golang.org/x/net/context"
)

func PrintOutOfDateWarnings(g *libkb.GlobalContext) {
	g.Log.Debug("+ PrintOutOfDateWarnings")
	defer g.Log.Debug("- PrintOutOfDateWarnings")

	cli, err := GetConfigClient(g)
	if err != nil {
		g.Log.Debug("Ignoring error in printOutOfDateWarnings: %s", err)
		return
	}

	info, err := cli.CheckAPIServerOutOfDateWarning(context.TODO())
	if err != nil {
		g.Log.Debug("Ignoring error in printOutOfDateWarnings: %s", err)
		return
	}
	g.Log.Debug("Got OutOfDateInfo: %#v", info)

	if info.CustomMessage != "" {
		printCustomMessage(g, info.CustomMessage)
	}
	if info.UpgradeTo != "" {
		g.Log.Warning("Upgrade recommended to client version %s or above (you have v%s)",
			info.UpgradeTo, libkb.VersionString())
	}
	if info.UpgradeURI != "" {
		libkb.PlatformSpecificUpgradeInstructions(g, info.UpgradeURI)
	}
}

type ClientSpecificCustomMessage struct {
	CliMessage string `json:"cli_message"`
	// Ignore other fields.
}

func printCustomMessage(g *libkb.GlobalContext, message string) {
	var parsedMessage ClientSpecificCustomMessage
	err := json.Unmarshal([]byte(message), &parsedMessage)
	if err != nil {
		g.Log.Debug("Failed to unmarshall client-out-of-date JSON: %s", err)
		g.Log.Warning(message)
		return
	}
	if parsedMessage.CliMessage == "" {
		g.Log.Debug("No CLI message after parsing client-out-of-date JSON.")
		g.Log.Warning(message)
		return
	}
	g.Log.Warning(parsedMessage.CliMessage)
}

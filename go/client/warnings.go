// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"time"

	humanize "github.com/dustin/go-humanize"
	"github.com/keybase/client/go/libkb"
	context "golang.org/x/net/context"
)

func PrintAccountResetWarning(g *libkb.GlobalContext) {
	g.Log.Debug("+ PrintAccountResetWarning")
	defer g.Log.Debug("- PrintAccountResetWarning")
	var err error
	defer func() {
		if err != nil {
			g.Log.Debug("Ignoring error in PrintAccountResetWarning: %s", err)
		}
	}()

	cli, err := GetBadgerClient(g)
	if err != nil {
		return
	}
	badgeState, err := cli.GetBadgeState(context.TODO())
	if err != nil {
		return
	}
	resetState := badgeState.ResetState
	if !resetState.Active {
		return
	}

	var msg string
	switch resetState.EndTime {
	case 0:
		msg = "Your account is ready to be reset."
	default:
		msg = fmt.Sprintf("Your account is scheduled to be reset in %v.", humanize.Time(resetState.EndTime.Time()))
	}
	g.Log.Warning(msg)
	g.Log.Warning("To cancel the process run `keybase account reset-cancel`")
}

func PrintOutOfDateWarnings(g *libkb.GlobalContext) {
	g.Log.Debug("+ PrintOutOfDateWarnings")
	defer g.Log.Debug("- PrintOutOfDateWarnings")
	var err error
	defer func() {
		if err != nil {
			g.Log.Debug("Ignoring error in PrintOutOfDateWarnings: %s", err)
		}
	}()

	cli, err := GetConfigClient(g)
	if err != nil {
		return
	}

	info, err := cli.CheckAPIServerOutOfDateWarning(context.TODO())
	if err != nil {
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
	if info.CriticalClockSkew != 0 {
		g.Log.Warning("Critical clock skew: Your clock is %s off from the server",
			time.Duration(info.CriticalClockSkew))
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

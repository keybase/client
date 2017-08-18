// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/base64"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdShowNotifications struct {
	libkb.Contextified
}

func (c *CmdShowNotifications) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdShowNotifications) Run() error {
	_, err := c.G().UI.GetTerminalUI().Printf("Showing notifications:\n")
	if err != nil {
		return err
	}

	display := newNotificationDisplay(c.G())

	// NB: Make sure to edit both of these at the same time.
	protocols := []rpc.Protocol{
		keybase1.NotifySessionProtocol(display),
		keybase1.NotifyUsersProtocol(display),
		keybase1.NotifyFSProtocol(display),
		keybase1.NotifyTrackingProtocol(display),
	}
	channels := keybase1.NotificationChannels{
		Session:  true,
		Users:    true,
		Kbfs:     true,
		Tracking: true,
	}

	if err := RegisterProtocols(protocols); err != nil {
		return err
	}
	cli, err := GetNotifyCtlClient(c.G())
	if err != nil {
		return err
	}
	if err := cli.SetNotifications(context.TODO(), channels); err != nil {
		return err
	}

	_, err = c.G().UI.GetTerminalUI().Printf("waiting for notifications...\n")
	if err != nil {
		return err
	}
	for {
		time.Sleep(time.Second)
	}
}

func NewCmdShowNotifications(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "show-notifications",
		Usage: "Display all notifications sent by daemon in real-time",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdShowNotifications{Contextified: libkb.NewContextified(g)}, "show-notifications", c)
		},
		Flags: []cli.Flag{},
	}
}

func (c *CmdShowNotifications) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

type notificationDisplay struct {
	libkb.Contextified
}

func newNotificationDisplay(g *libkb.GlobalContext) *notificationDisplay {
	return &notificationDisplay{Contextified: libkb.NewContextified(g)}
}

func (d *notificationDisplay) printf(fmt string, args ...interface{}) error {
	_, err := d.G().UI.GetTerminalUI().Printf(fmt, args...)
	return err
}

func (d *notificationDisplay) LoggedOut(_ context.Context) error {
	return d.printf("Logged out\n")
}
func (d *notificationDisplay) LoggedIn(_ context.Context, un string) error {
	return d.printf("Logged in as %q\n", un)
}
func (d *notificationDisplay) ClientOutOfDate(_ context.Context, arg keybase1.ClientOutOfDateArg) (err error) {
	if arg.UpgradeMsg != "" {
		var decodedMsg []byte
		decodedMsg, err = base64.StdEncoding.DecodeString(arg.UpgradeMsg)
		if err == nil {
			err = d.printf("%v\n", string(decodedMsg))
		}
	}
	if arg.UpgradeTo != "" || arg.UpgradeURI != "" {
		if err2 := d.printf("Client out of date, upgrade to %v, uri %v\n", arg.UpgradeTo, arg.UpgradeURI); err == nil && err2 != nil {
			err = err2
		}
	}
	return
}

func (d *notificationDisplay) UserChanged(_ context.Context, uid keybase1.UID) error {
	return d.printf("User %s changed\n", uid)
}

func (d *notificationDisplay) FSActivity(_ context.Context, notification keybase1.FSNotification) error {
	return d.printf("KBFS notification: %+v\n", notification)
}

func (d *notificationDisplay) FSSyncActivity(_ context.Context, status keybase1.FSPathSyncStatus) error {
	return d.printf("KBFS path sync status: %+v\n", status)
}

func (d *notificationDisplay) FSEditListResponse(
	_ context.Context, arg keybase1.FSEditListResponseArg) error {
	return d.printf("KBFS edit list response: %+v\n", arg)
}

func (d *notificationDisplay) FSSyncStatusResponse(
	_ context.Context, arg keybase1.FSSyncStatusResponseArg) error {
	return d.printf("KBFS sync status response: %+v\n", arg)
}

func (d *notificationDisplay) TrackingChanged(_ context.Context, arg keybase1.TrackingChangedArg) error {
	return d.printf("Tracking changed for %s (%s)\n", arg.Username, arg.Uid)
}

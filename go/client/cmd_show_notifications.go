// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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
		keybase1.NotifyAuditProtocol(display),
		keybase1.NotifyRuntimeStatsProtocol(display),
	}
	channels := keybase1.NotificationChannels{
		Session:      true,
		Users:        true,
		Kbfs:         true,
		Tracking:     true,
		Audit:        true,
		Runtimestats: true,
	}

	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
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
			cl.SetNoStandalone()
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
func (d *notificationDisplay) LoggedIn(_ context.Context, arg keybase1.LoggedInArg) error {
	return d.printf("Logged in as %q, signedUp: %t\n", arg.Username, arg.SignedUp)
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

func (d *notificationDisplay) PasswordChanged(_ context.Context) error {
	return d.printf("Password changed\n")
}

func (d *notificationDisplay) FSOnlineStatusChanged(_ context.Context, online bool) error {
	return d.printf("KBFS online status changed: online=%+v\n", online)
}

func (d *notificationDisplay) FSOverallSyncStatusChanged(_ context.Context,
	status keybase1.FolderSyncStatus) error {
	return d.printf("KBFS overall sync status: %+v\n", status)
}

func (d *notificationDisplay) FSFavoritesChanged(_ context.Context) error {
	return d.printf("KBFS favorites changed\n")
}

func (d *notificationDisplay) FSActivity(_ context.Context, notification keybase1.FSNotification) error {
	return d.printf("KBFS notification: %+v\n", notification)
}

func (d *notificationDisplay) FSPathUpdated(
	_ context.Context, path string) error {
	return d.printf("KBFS path updated notification: %s\n", path)
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

func (d *notificationDisplay) TrackingInfo(_ context.Context, arg keybase1.TrackingInfoArg) error {
	return d.printf("Tracking info for %s followers: %v followees: %v\n", arg.Uid, arg.Followers,
		arg.Followees)
}

func (d *notificationDisplay) RootAuditError(_ context.Context, msg string) (err error) {
	return d.printf("Merkle root audit error: %s\n", msg)
}

func (d *notificationDisplay) BoxAuditError(_ context.Context, msg string) (err error) {
	return d.printf("Box audit error (report with `keybase log send`): %s\n", msg)
}

func (d *notificationDisplay) RuntimeStatsUpdate(
	_ context.Context, stats *keybase1.RuntimeStats) (err error) {
	err = d.printf("Runtime stats:")
	if err != nil {
		return err
	}

	comma := ""
	for _, s := range stats.ProcessStats {
		err = d.printf(
			"%s [%s: Goheap=%s, Goheapsys=%s, Goreleased=%s]",
			comma, s.Type, s.Goheap, s.Goheapsys, s.Goreleased)
		if err != nil {
			return err
		}
		comma = ","
	}

	for _, s := range stats.DbStats {
		if !s.MemCompActive && !s.TableCompActive {
			continue
		}

		var name string
		switch s.Type {
		case keybase1.DbType_MAIN:
			name = "dbMain"
		case keybase1.DbType_CHAT:
			name = "dbChat"
		case keybase1.DbType_FS_BLOCK_CACHE:
			name = "dbFSBlockCache"
		case keybase1.DbType_FS_BLOCK_CACHE_META:
			name = "dbFSMetaBlockCache"
		case keybase1.DbType_FS_SYNC_BLOCK_CACHE:
			name = "dbFSSyncBlockCache"
		case keybase1.DbType_FS_SYNC_BLOCK_CACHE_META:
			name = "dbFSMetaSyncBlockCache"
		}
		err = d.printf(
			", %s=[M:%t T:%t] ", name, s.MemCompActive, s.TableCompActive)
		if err != nil {
			return err
		}
	}
	return d.printf("\n")
}

func (d *notificationDisplay) FSSubscriptionNotify(_ context.Context, arg keybase1.FSSubscriptionNotifyArg) error {
	return d.printf("FS subscription notify: %s %s\n", arg.SubscriptionID, arg.Topic.String())
}
func (d *notificationDisplay) FSSubscriptionNotifyPath(_ context.Context, arg keybase1.FSSubscriptionNotifyPathArg) error {
	return d.printf("FS subscription notify path: %s %q %s\n", arg.SubscriptionID, arg.Path, arg.Topic.String())
}
func (d *notificationDisplay) IdentifyUpdate(_ context.Context, arg keybase1.IdentifyUpdateArg) error {
	return d.printf("identify update: ok:%v broken:%v\n", arg.OkUsernames, arg.BrokenUsernames)
}

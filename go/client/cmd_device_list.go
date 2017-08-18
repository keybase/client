// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdDeviceList is the 'device list' command.  It displays all
// the devices for the current user.
type CmdDeviceList struct {
	all bool
	libkb.Contextified
}

// NewCmdDeviceList creates a new cli.Command.
func NewCmdDeviceList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "list",
		Usage: "List devices",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceList{Contextified: libkb.NewContextified(g)}, "list", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdDeviceList) Run() error {
	cli, err := GetDeviceClient(c.G())
	if err != nil {
		return err
	}
	if err := RegisterProtocols(nil); err != nil {
		return err
	}

	devs, err := cli.DeviceList(context.TODO(), 0)
	if err != nil {
		return err
	}
	c.output(devs)
	return nil
}

func (c *CmdDeviceList) output(devs []keybase1.Device) {
	w := GlobUI.DefaultTabWriter()
	fmt.Fprintf(w, "Name\tType\tID\tCreated\tLast Used\n")
	fmt.Fprintf(w, "==========\t==========\t==========\t==========\t==========\n")
	for _, v := range devs {
		cTime := keybase1.FromTime(v.CTime)
		lastUsedTime := keybase1.FromTime(v.LastUsedTime)
		timeFormat := "2006 Jan 2 15:04:05"
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", v.Name, v.Type, v.DeviceID, cTime.Format(timeFormat), lastUsedTime.Format(timeFormat))
	}
	w.Flush()
}

// ParseArgv does nothing for this command.
func (c *CmdDeviceList) ParseArgv(ctx *cli.Context) error {
	c.all = ctx.Bool("all")
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdDeviceList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}

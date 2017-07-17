// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdDeviceRemove struct {
	idOrName string
	force    bool
	libkb.Contextified
}

func (c *CmdDeviceRemove) SetIDOrName(s string) {
	c.idOrName = s
}

func (c *CmdDeviceRemove) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Device remove only takes one argument: the device ID or name.")
	}
	c.idOrName = ctx.Args()[0]
	c.force = ctx.Bool("force")
	return nil
}

func (c *CmdDeviceRemove) confirmDelete(id keybase1.DeviceID) error {
	if c.force {
		return nil
	}
	rkcli, err := GetRekeyClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.GetRevokeWarningArg{TargetDevice: id}
	res, err := rkcli.GetRevokeWarning(context.TODO(), arg)
	if err != nil {
		return err
	}
	if len(res.EndangeredTLFs) == 0 {
		return nil
	}
	tui := c.G().UI.GetTerminalUI()
	if tui == nil {
		return errors.New("Need a terminal UI to prompt for TLF data loss override")
	}

	out := "Are you sure you want to delete this device? If you do, you can lose KBFS access to:\n"
	n := len(res.EndangeredTLFs)
	for i, tlf := range res.EndangeredTLFs {
		if i == 10 && n > 11 {
			out += fmt.Sprintf("   .... and %d others\n", (n - 10))
			break
		}
		out += fmt.Sprintf(" * %s\n", tlf.Name)
	}

	tui.OutputDesc(OutputDescriptorEndageredTLFs, out)
	ok, err := tui.PromptYesNo(PromptDescriptorDeviceRevoke, "Go ahead anyway?", libkb.PromptDefaultNo)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("not confirmed")
	}

	return nil
}

func (c *CmdDeviceRemove) Run() (err error) {
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err = RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	var id keybase1.DeviceID
	id, err = keybase1.DeviceIDFromString(c.idOrName)
	if err != nil {
		id, err = c.lookup(c.idOrName)
		if err != nil {
			return err
		}
	}

	if err = c.confirmDelete(id); err != nil {
		return err
	}

	cli, err := GetRevokeClient(c.G())
	if err != nil {
		return err
	}

	return cli.RevokeDevice(context.TODO(), keybase1.RevokeDeviceArg{
		Force:    c.force,
		DeviceID: id,
	})
}

func (c *CmdDeviceRemove) lookup(name string) (keybase1.DeviceID, error) {
	cli, err := GetDeviceClient(c.G())
	if err != nil {
		return "", err
	}
	devs, err := cli.DeviceList(context.TODO(), 0)
	if err != nil {
		return "", err
	}

	for _, dev := range devs {
		if dev.Name == name {
			return dev.DeviceID, nil
		}
	}
	return "", fmt.Errorf("Invalid Device ID or Unknown Device Name")
}

func NewCmdDeviceRemove(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "remove",
		ArgumentHelp: "<id|name>",
		Usage:        "Remove a device",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "Override warning about removing the current device.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdDeviceRemoveRunner(g), "remove", c)
		},
	}
}

func NewCmdDeviceRemoveRunner(g *libkb.GlobalContext) *CmdDeviceRemove {
	return &CmdDeviceRemove{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdDeviceRemove) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}

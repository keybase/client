package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func NewCmdSelfProvision(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := cli.Command{
		Name:         "selfprovision",
		ArgumentHelp: "[newdevicename]",
		Usage:        "Provision a new device if the current device is a clone.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdSelfProvisionRunner(g), "selfprovision", c)
		},
	}
	return cmd
}

type CmdSelfProvision struct {
	libkb.Contextified
	deviceName string
	SessionID  int
}

func NewCmdSelfProvisionRunner(g *libkb.GlobalContext) *CmdSelfProvision {
	return &CmdSelfProvision{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdSelfProvision) Run() (err error) {

	client, err := GetSelfProvisionClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewLoginUIProtocol(c.G()),
		NewSecretUIProtocol(c.G()),
	}
	if err = RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	if err := client.SelfProvision(context.TODO(),
		keybase1.SelfProvisionArg{
			DeviceName: c.deviceName,
			SessionID:  c.SessionID,
		}); err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Self-provisioning successful.\n")
	return nil
}

func (c *CmdSelfProvision) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	if nargs != 1 {
		return errors.New("devicename argument is required")
	}

	c.deviceName = ctx.Args()[0]

	if c.deviceName == "" {
		return errors.New("Devicename argument is required")
	}

	return nil
}

func (c *CmdSelfProvision) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}

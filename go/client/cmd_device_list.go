package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// CmdDeviceList is the 'device list' command.  It displays all
// the devices for the current user.
type CmdDeviceList struct{}

// NewCmdDeviceList creates a new cli.Command.
func NewCmdDeviceList(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "list",
		Usage:       "keybase device list",
		Description: "List devices",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceList{}, "list", c)
		},
	}
}

// Run runs the command in standalone mode.
func (c *CmdDeviceList) Run() error {
	ctx := &engine.Context{}
	eng := engine.NewDevList()
	return engine.RunEngine(eng, ctx, nil, nil)
}

// RunClient runs the command in client/server mode.
func (c *CmdDeviceList) RunClient() error {
	cli, err := GetDeviceClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.DeviceList()
}

// ParseArgv does nothing for this command.
func (c *CmdDeviceList) ParseArgv(ctx *cli.Context) error {
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdDeviceList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  true,
		API:        true,
		Terminal:   true,
	}
}

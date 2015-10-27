package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

// CmdDeviceXAdd is the 'device xadd' command.  It is used for
// device provisioning on the provisioner/device X/C1.
type CmdDeviceXAdd struct{}

const cmdDevXAddDesc = `When you are adding a new device to your account and you have an 
existing device, you will be prompted to use this command on your
existing device to authorize the new device.`

// NewCmdDeviceXAdd creates a new cli.Command.
func NewCmdDeviceXAdd(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "xadd",
		Usage:       "Authorize a new device",
		Description: cmdDevXAddDesc,
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceXAdd{}, "xadd", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdDeviceXAdd) Run() error {
	var err error
	cli, err := GetDeviceClient()
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewProvisionUIProtocol(G, true /* device provisioner */),
		NewSecretUIProtocol(G),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.DeviceXAdd(context.TODO(), 0)
}

// ParseArgv gets the secret phrase from the command args.
func (c *CmdDeviceXAdd) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return fmt.Errorf("device xadd takes zero arguments")
	}
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdDeviceXAdd) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}

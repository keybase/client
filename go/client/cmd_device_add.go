package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

// CmdDeviceAdd is the 'device add' command.  It is used for
// device provisioning to enter a secret phrase on an existing
// device.
type CmdDeviceAdd struct {
	phrase    string
	sessionID int
}

const cmdDevAddDesc = `When you are adding a new device to your account and you have an 
existing device, you will be prompted to use this command on your
existing device to authorize the new device.`

// NewCmdDeviceAdd creates a new cli.Command.
func NewCmdDeviceAdd(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "add",
		Usage:        "Authorize a new device",
		Description:  cmdDevAddDesc,
		ArgumentHelp: "<secret-phrase>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceAdd{}, "add", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdDeviceAdd) Run() error {
	var err error
	c.sessionID, err = libkb.RandInt()
	if err != nil {
		return err
	}
	cli, err := GetDeviceClient()
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(),
		NewLocksmithUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.DeviceAdd(keybase1.DeviceAddArg{SecretPhrase: c.phrase, SessionID: c.sessionID})
}

// ParseArgv gets the secret phrase from the command args.
func (c *CmdDeviceAdd) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Device add only takes one argument, the secret phrase.")
	}
	c.phrase = ctx.Args()[0]
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdDeviceAdd) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}

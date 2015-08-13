package client

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

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
	protocols := []rpc2.Protocol{
		NewSecretUIProtocol(),
		NewLocksmithUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.DeviceAdd(keybase1.DeviceAddArg{SecretPhrase: c.secretPhrase, SessionID: c.sessionID})
}

// GetUsage says what this command needs to operate.
func (c *CmdDeviceAdd) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}

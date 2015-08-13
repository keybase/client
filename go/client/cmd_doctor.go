package client

import (
	"github.com/keybase/client/go/libkb"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func (c *CmdDoctor) Run() error {
	cli, err := GetDoctorClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewDoctorUIProtocol(),
		NewSecretUIProtocol(),
		NewLogUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}
	return cli.Doctor(0)
}

func (c *CmdDoctor) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

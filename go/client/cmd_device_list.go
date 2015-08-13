package client

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// RunClient runs the command in client/server mode.
func (c *CmdDeviceList) Run() error {
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

	devs, err := cli.DeviceList(keybase1.DeviceListArg{All: c.all})
	if err != nil {
		return err
	}
	c.output(devs)
	return nil
}

func (c *CmdDeviceList) output(devs []keybase1.Device) {
	w := GlobUI.DefaultTabWriter()
	fmt.Fprintf(w, "Name\tType\tID\n")
	fmt.Fprintf(w, "==========\t==========\t==========\n")
	for _, v := range devs {
		fmt.Fprintf(w, "%s\t%s\t%s\n", v.Name, v.Type, v.DeviceID)
	}
	w.Flush()
}

// GetUsage says what this command needs to operate.
func (c *CmdDeviceList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}

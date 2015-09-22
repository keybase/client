package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// CmdDeviceList is the 'device list' command.  It displays all
// the devices for the current user.
type CmdDeviceList struct {
	all bool
}

// NewCmdDeviceList creates a new cli.Command.
func NewCmdDeviceList(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "list",
		Usage: "List devices",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDeviceList{}, "list", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdDeviceList) Run() error {
	cli, err := GetDeviceClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}

	devs, err := cli.DeviceList(0)
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

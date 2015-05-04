package client

import (
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
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
	ctx := &engine.Context{LogUI: G_UI.GetLogUI()}
	eng := engine.NewDevList()
	if err := engine.RunEngine(eng, ctx); err != nil {
		return err
	}
	devs := eng.List()
	c.output(devs)
	return nil
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

	devs, err := cli.DeviceList(0)
	if err != nil {
		return err
	}
	c.output(devs)
	return nil
}

func (c *CmdDeviceList) output(devs []keybase1.Device) {
	w := new(tabwriter.Writer)
	w.Init(os.Stdout, 5, 0, 3, ' ', 0)
	fmt.Fprintf(w, "Name\tType\tID\n")
	fmt.Fprintf(w, "==========\t==========\t==========\n")
	for _, v := range devs {
		fmt.Fprintf(w, "%s\t%s\t%s\n", v.Name, v.Type, v.DeviceID)
	}
	w.Flush()
}

// ParseArgv does nothing for this command.
func (c *CmdDeviceList) ParseArgv(ctx *cli.Context) error {
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

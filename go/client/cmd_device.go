package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
)

// NewCmdDevice creates the device command, which is just a holder
// for subcommands.
func NewCmdDevice(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "device",
		Usage:       "keybase device [...]",
		Description: "Manage your devices.",
		Subcommands: []cli.Command{
			NewCmdDeviceAdd(cl),
			NewCmdDeviceRemove(cl),
			NewCmdDeviceList(cl),
		},
	}
}

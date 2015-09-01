// +build darwin

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdLaunchd(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "launchd",
		Usage:       "keybase launchd [subcommands...]",
		Description: "Manage keybase launchd services",
		Subcommands: []cli.Command{
			NewCmdLaunchdInstall(cl),
			NewCmdLaunchdUninstall(cl),
			NewCmdLaunchdList(cl),
			NewCmdLaunchdStatus(cl),
		},
	}
}

func NewCmdLaunchdInstall(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "install",
		Usage:       "keybase launchd install <label> <path/to/keybase>",
		Description: "Install a keybase launchd service",
		Action: func(c *cli.Context) {
			run := func() error {
				args := c.Args()
				if len(args) < 1 {
					return fmt.Errorf("No label specified")
				}
				if len(args) < 2 {
					return fmt.Errorf("No path to keybase executable specified")
				}
				return Install(args[0], args[1])
			}
			cl.ChooseCommand(&cmdLaunchd{run}, "install", c)
			cl.SetForkCmd(libcmdline.NoFork)
		},
	}
}

func NewCmdLaunchdUninstall(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "uninstall",
		Usage:       "keybase launchd uninstall <label>",
		Description: "Uninstall a keybase launchd service",
		Action: func(c *cli.Context) {
			run := func() error {
				args := c.Args()
				if len(args) < 1 {
					return fmt.Errorf("No label specified")
				}
				return Uninstall(args[0])
			}
			cl.ChooseCommand(&cmdLaunchd{run}, "uninstall", c)
			cl.SetForkCmd(libcmdline.NoFork)
		},
	}
}

func NewCmdLaunchdList(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "list",
		Usage:       "keybase launchd list",
		Description: "List keybase launchd services",
		Action: func(c *cli.Context) {
			run := func() error {
				return ShowServices()
			}
			cl.ChooseCommand(&cmdLaunchd{run}, "list", c)
			cl.SetForkCmd(libcmdline.NoFork)
		},
	}
}

func NewCmdLaunchdStatus(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "status",
		Usage:       "keybase launchd status <label>",
		Description: "Status for keybase launchd service",
		Action: func(c *cli.Context) {
			run := func() error {
				args := c.Args()
				if len(args) < 1 {
					return fmt.Errorf("No label specified")
				}
				return ShowStatus(args[0])
			}
			cl.ChooseCommand(&cmdLaunchd{run}, "status", c)
			cl.SetForkCmd(libcmdline.NoFork)
		},
	}
}

type cmdLaunchd struct {
	run func() error
}

func (c cmdLaunchd) ParseArgv(*cli.Context) error {
	return nil
}

func (c cmdLaunchd) Run() error {
	return c.run()
}

func (c *cmdLaunchd) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

// +build darwin

package client

import (
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
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
			args := c.Args()
			if len(args) < 1 {
				G.Log.Fatalf("No label specified")
			}
			if len(args) < 2 {
				G.Log.Fatalf("No path to keybase executable specified")
			}
			err := Install(args[0], args[1])
			if err != nil {
				G.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdUninstall(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "uninstall",
		Usage:       "keybase launchd uninstall <label>",
		Description: "Uninstall a keybase launchd service",
		Action: func(c *cli.Context) {
			args := c.Args()
			if len(args) < 1 {
				G.Log.Fatalf("No label specified")
			}
			err := Uninstall(args[0])
			if err != nil {
				G.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdList(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "list",
		Usage:       "keybase launchd list",
		Description: "List keybase launchd services",
		Action: func(c *cli.Context) {
			err := ShowServices()
			if err != nil {
				G.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdStatus(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "status",
		Usage:       "keybase launchd status <label>",
		Description: "Status for keybase launchd service",
		Action: func(c *cli.Context) {
			args := c.Args()
			if len(args) < 1 {
				G.Log.Fatalf("No label specified")
			}
			err := ShowStatus(args[0])
			if err != nil {
				G.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

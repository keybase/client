// +build darwin

package client

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/protocol"
)

func NewCmdLaunchd(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "launchd",
		Usage:        "Manage keybase launchd services",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdLaunchdInstall(cl),
			NewCmdLaunchdUninstall(cl),
			NewCmdLaunchdList(cl),
			NewCmdLaunchdStatus(cl),
			NewCmdLaunchdStart(cl),
			NewCmdLaunchdStop(cl),
			NewCmdLaunchdRestart(cl),
		},
	}
}

func NewCmdLaunchdInstall(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "install",
		ArgumentHelp: "<label> <path/to/keybase> <args>",
		Usage:        "Install a launchd service",
		Action: func(c *cli.Context) {
			args := c.Args()
			if len(args) < 1 {
				G.Log.Fatalf("No label specified.")
			}
			if len(args) < 2 {
				G.Log.Fatalf("No path to keybase executable specified.")
			}

			label := args[0]
			binPath := args[1]
			plistArgs := args[2:]

			envVars := make(map[string]string)
			envVars["PATH"] = "/sbin:/usr/sbin:/bin:/usr/bin:/usr/local/bin"
			envVars["KEYBASE_LABEL"] = label
			envVars["KEYBASE_LOG_FORMAT"] = "file"
			envVars["KEYBASE_RUNTIME_DIR"] = runtimeDir()

			plist := launchd.NewPlist(label, binPath, plistArgs, envVars)
			err := launchd.Install(plist)
			if err != nil {
				G.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdUninstall(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "uninstall",
		ArgumentHelp: "<label>",
		Usage:        "Uninstall a keybase launchd service",
		Action: func(c *cli.Context) {
			args := c.Args()
			if len(args) < 1 {
				G.Log.Fatalf("No label specified.")
			}
			err := launchd.Uninstall(args[0])
			if err != nil {
				G.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdList(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "list",
		Usage: "List keybase launchd services",
		Action: func(c *cli.Context) {
			var err error
			err = launchd.ShowServices("keybase.", "Keybase")
			if err != nil {
				G.Log.Fatalf("%v", err)
			}
			err = launchd.ShowServices("kbfs.", "KBFS")
			if err != nil {
				G.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdRestart(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "restart",
		ArgumentHelp: "<label>",
		Usage:        "Restart a keybase launchd service",
		Action: func(c *cli.Context) {
			args := c.Args()
			if len(args) < 1 {
				G.Log.Fatalf("No label specified.")
			}
			err := launchd.Restart(args[0])
			if err != nil {
				G.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdStart(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "start",
		ArgumentHelp: "<label>",
		Usage:        "Start a keybase launchd service",
		Action: func(c *cli.Context) {
			args := c.Args()
			if len(args) < 1 {
				G.Log.Fatalf("No label specified")
			}
			err := launchd.Start(args[0])
			if err != nil {
				G.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdStop(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "stop",
		ArgumentHelp: "<label>",
		Usage:        "Stop a keybase launchd service",
		Action: func(c *cli.Context) {
			args := c.Args()
			if len(args) < 1 {
				G.Log.Fatalf("No label specified.")
			}
			err := launchd.Stop(args[0])
			if err != nil {
				G.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdStatus(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "status",
		ArgumentHelp: "<service-name> <bundle-version>",
		Usage:        "Status for keybase launchd service, including for installing or updating",
		Action: func(c *cli.Context) {
			args := c.Args()
			if len(args) < 1 {
				G.Log.Fatalf("No service name specified.")
			}
			if len(args) < 2 {
				G.Log.Fatalf("No bundle version specified.")
			}
			err := ShowServiceStatus(args[0], args[1])
			if err != nil {
				G.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func ShowServiceStatus(name string, bundleVersion string) error {
	var st keybase1.ServiceStatus
	if name == "service" {
		st = KeybaseServiceStatus(bundleVersion)
	} else if name == "kbfs" {
		st = KBFSServiceStatus(bundleVersion)
	} else {
		return fmt.Errorf("Invalid service name: %s", name)
	}

	out, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return err
	}

	GlobUI.Printf("%s\n", out)
	return nil
}

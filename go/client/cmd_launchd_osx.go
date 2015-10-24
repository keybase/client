// +build darwin

package client

import (
	"encoding/json"
	"fmt"
	"os"
	"runtime"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
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
			NewCmdLaunchdConfig(cl),
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

			homeDir := os.Getenv("HOME")
			home := libkb.NewHomeFinder("keybase",
				func() string { return homeDir },
				runtime.GOOS,
				func() libkb.RunMode { return libkb.DefaultRunMode })

			envVars := make(map[string]string)
			envVars["PATH"] = "/sbin:/usr/sbin:/bin:/usr/bin:/usr/local/bin"
			envVars["KEYBASE_LABEL"] = label
			envVars["KEYBASE_LOG_FORMAT"] = "file"
			envVars["KEYBASE_RUNTIME_DIR"] = home.RuntimeDir()

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

func NewCmdLaunchdStatus(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "status",
		ArgumentHelp: "<label>",
		Usage:        "Status for keybase launchd service",
		Action: func(c *cli.Context) {
			args := c.Args()
			if len(args) < 1 {
				G.Log.Fatalf("No label specified.")
			}
			err := launchd.ShowStatus(args[0])
			if err != nil {
				G.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdConfig(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "config",
		ArgumentHelp: "",
		Usage:        "Config for keybase launchd service",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdLaunchdConfig{}, "config", c)
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

type CmdLaunchdConfig struct{}

func (v *CmdLaunchdConfig) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (v *CmdLaunchdConfig) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (v *CmdLaunchdConfig) Run() error {
	configCli, err := GetConfigClient(G)
	if err != nil {
		return err
	}

	config, err := configCli.GetConfig(context.TODO(), 0)
	if err != nil {
		return err
	}

	configJSON, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	GlobUI.Printf("%s\n", configJSON)
	return nil
}

func DiagnoseSocketError(err error) {
	services, err := launchd.ListServices("keybase.")
	if err != nil {
		GlobUI.Printf("Error checking launchd services: %v\n\n", err)
		return
	}

	if len(services) == 0 {
		GlobUI.Println("\nThere are no Keybase services installed. You may need to re-install.")
	} else if len(services) > 1 {
		GlobUI.Println("\nWe found multiple services:")
		for _, service := range services {
			GlobUI.Println("  " + service.StatusDescription())
		}
		GlobUI.Println("")
	} else if len(services) == 1 {
		service := services[0]
		status, err := service.Status()
		if err != nil {
			G.Log.Errorf("Error checking service status(%s): %v\n\n", service.Label(), err)
		} else {
			if status == nil || !status.IsRunning() {
				GlobUI.Printf("\nWe found a Keybase service (%s) but it's not running.\n", service.Label())
				cmd := fmt.Sprintf("keybase launchd start %s", service.Label())
				GlobUI.Println("You might try starting it: " + cmd + "\n")
			} else {
				GlobUI.Printf("\nWe couldn't connect but there is a Keybase service (%s) running (%s).\n", status.Label(), status.Pid())
				cmd := fmt.Sprintf("keybase launchd restart %s", service.Label())
				GlobUI.Println("You might try restarting it: " + cmd + "\n")
			}
		}
	}
}

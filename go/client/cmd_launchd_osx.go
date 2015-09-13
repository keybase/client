// +build darwin

package client

import (
	"fmt"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
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
		ArgumentHelp: "<label> <path/to/keybase>",
		Usage:        "Install a keybase launchd service",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "run-mode",
				Usage: fmt.Sprintf("Run mode (%s)", libkb.RunModes),
			},
		},
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

			plistArgs := []string{}
			plistArgs = append(plistArgs, fmt.Sprintf("--label=%s", label))
			plistArgs = append(plistArgs, "--log-format=file")
			runMode := c.String("run-mode")
			if runMode != "" {
				plistArgs = append(plistArgs, fmt.Sprintf("--run-mode=%s", runMode))
			}
			plistArgs = append(plistArgs, "service")

			envVars := make(map[string]string)
			envVars["PATH"] = "/sbin:/usr/sbin:/bin:/usr/bin:/usr/local/bin"

			workingDir := G.Env.GetCacheDir()

			plist := launchd.NewPlist(label, binPath, plistArgs, envVars, workingDir)
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
			err := launchd.ShowServices("keybase")
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

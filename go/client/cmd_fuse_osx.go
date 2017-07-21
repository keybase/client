// +build darwin

package client

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdFuse(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "fuse",
		Usage:        "Manage fuse",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdFuseStatus(cl, g),
			newCmdFuseLoadKext(cl, g),
		},
	}
}

func NewCmdFuseStatus(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "status",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "b, bundle-version",
				Usage: "Bundle version",
			},
		},
		Usage: "Status for fuse, including for installing or updating",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(NewCmdFuseStatusRunner(g), "status", c)
		},
	}
}

type CmdFuseStatus struct {
	libkb.Contextified
	bundleVersion string
}

func NewCmdFuseStatusRunner(g *libkb.GlobalContext) *CmdFuseStatus {
	return &CmdFuseStatus{
		Contextified: libkb.NewContextified(g),
	}
}

func (v *CmdFuseStatus) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (v *CmdFuseStatus) ParseArgv(ctx *cli.Context) error {
	v.bundleVersion = ctx.String("bundle-version")
	return nil
}

func (v *CmdFuseStatus) Run() error {
	status := install.KeybaseFuseStatus(v.bundleVersion, v.G().Log)
	out, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return err
	}

	fmt.Fprintf(os.Stdout, "%s\n", out)
	return nil
}

func newCmdFuseLoadKext(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "load-kext",
		Usage: "Load the Fuse kext",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(newCmdFuseLoadKextRunner(g), "load-kext", c)
		},
	}
}

type cmdFuseLoadKext struct {
	libkb.Contextified
}

func newCmdFuseLoadKextRunner(g *libkb.GlobalContext) *cmdFuseLoadKext {
	return &cmdFuseLoadKext{
		Contextified: libkb.NewContextified(g),
	}
}

func (v *cmdFuseLoadKext) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (v *cmdFuseLoadKext) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (v *cmdFuseLoadKext) Run() error {
	status := install.LoadFuseKext(v.G().Log)
	out, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stdout, "%s\n", out)
	return nil
}

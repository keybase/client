// +build darwin

package client

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/keybase/cli"
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
		},
	}
}

func NewCmdFuseStatus(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "status",
		ArgumentHelp: "<kext-label> <bundle-version>",
		Usage:        "Status for fuse, including for installing or updating",
		Action: func(c *cli.Context) {
			g.Env.SetSkipLogForward()

			cl.ChooseCommand(NewCmdFuseStatusRunner(g), "fuse", c)
		},
	}
}

type CmdFuseStatus struct {
	libkb.Contextified
	kextID        string
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
	v.kextID = ctx.String("kext-id")
	v.bundleVersion = ctx.String("bundle-version")
	return nil
}

func (v *CmdFuseStatus) Run() error {
	status := KeybaseFuseStatus(v.kextID, v.bundleVersion)
	out, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return err
	}

	fmt.Fprintf(os.Stdout, "%s\n", out)
	return nil
}

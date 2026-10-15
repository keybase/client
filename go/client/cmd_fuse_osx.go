//go:build darwin

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
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdFuseStatus(cl, g),
		},
	}
}

func NewCmdFuseStatus(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "status",
		Usage: "Status of the macFUSE install (https://macfuse.io)",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(NewCmdFuseStatusRunner(g), "status", c)
		},
	}
}

type CmdFuseStatus struct {
	libkb.Contextified
}

func NewCmdFuseStatusRunner(g *libkb.GlobalContext) *CmdFuseStatus {
	return &CmdFuseStatus{
		Contextified: libkb.NewContextified(g),
	}
}

func (v *CmdFuseStatus) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (v *CmdFuseStatus) ParseArgv(*cli.Context) error {
	return nil
}

func (v *CmdFuseStatus) Run() error {
	status := install.KeybaseFuseStatus("", v.G().Log)
	mountDir, err := v.G().Env.GetMountDir()
	if err != nil {
		v.G().Log.Warning("Unable to get the mount dir; reporting no KBFS mount: %s", err)
	}
	install.FilterKBFSMountInfos(&status, mountDir)
	out, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return err
	}

	fmt.Fprintf(os.Stdout, "%s\n", out)
	return nil
}

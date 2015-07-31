package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdVersion struct{}

func (v *CmdVersion) RunClient() error {
	libkb.VersionMessage(func(s string) { fmt.Println(s) })
	return nil
}

func NewCmdVersion(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "version",
		Usage: "print out version information",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdVersion{}, "version", c)
		},
	}
}

func (v *CmdVersion) ParseArgv(*cli.Context) error { return nil }

func (v *CmdVersion) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
	}
}

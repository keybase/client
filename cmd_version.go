package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdVersion struct{}

func (v *CmdVersion) Run() error {
	libkb.VersionMessage(func(s string) { fmt.Println(s) })
	return nil
}

func NewCmdVersion(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:  "version",
		Usage: "print out version information",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdVersion{}, "version", c)
		},
	}
}

func (c *CmdVersion) ParseArgv(*cli.Context) error { return nil }

func (v *CmdVersion) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
	}
}

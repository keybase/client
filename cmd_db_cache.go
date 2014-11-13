package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdDbCache struct {
	input string
}

func (v *CmdDbCache) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	if nargs == 1 {
		v.input = ctx.Args()[0]
	} else {
		err = fmt.Errorf("getuser takes one arg -- the user to load")
	}
	return err
}

func (v *CmdDbCache) Run() error {

	// XXX maybe do some sort of debug dump with the user that
	// we loaded from the server (or storage).
	_, err := libkb.LoadUser(libkb.LoadUserArg{
		Name:              v.input,
		PublicKeyOptional: true,
	})

	return err
}

func NewCmdDbCache(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:        "cache",
		Usage:       "keybase db cache <username>",
		Description: "Load, verify, and cache a user",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDbCache{}, "cache", c)
		},
	}
}

func (v *CmdDbCache) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  false,
		API:        true,
		Terminal:   false,
	}
}

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
		Name:             v.input,
		RequirePublicKey: false,
		Self:             false,
		LoadSecrets:      false,
		ForceReload:      false,
		SkipVerify:       false,
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

func (v *CmdDbCache) UseConfig() bool   { return true }
func (v *CmdDbCache) UseKeyring() bool  { return false }
func (v *CmdDbCache) UseAPI() bool      { return true }
func (v *CmdDbCache) UseTerminal() bool { return false }

package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdMe struct {
}

func (v *CmdMe) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	if nargs != 0 {
		err = fmt.Errorf("me takes no args")
	}
	return err
}

func (v *CmdMe) Run() error {
	arg := libkb.LoadUserArg{
		RequirePublicKey: true,
	}
	_, err := libkb.LoadMe(arg)
	return err
}

func NewCmdMe(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:        "me",
		Usage:       "keybase me",
		Description: "identify yourself (if necessary)",
		Flags:       []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdMe{}, "me", c)
		},
	}
}

func (v *CmdMe) UseConfig() bool   { return true }
func (v *CmdMe) UseKeyring() bool  { return true }
func (v *CmdMe) UseAPI() bool      { return true }
func (v *CmdMe) UseTerminal() bool { return true }

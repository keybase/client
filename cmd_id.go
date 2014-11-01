package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdId struct {
	user      string
	assertion string
	track     bool
}

func (v *CmdId) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	v.track = ctx.Bool("track-statement")
	if nargs == 1 {
		v.user = ctx.Args()[0]
	} else {
		err = fmt.Errorf("id takes one arg -- the user to lookup")
	}
	return err
}

func (v *CmdId) Run() error {
	u, err := libkb.LoadUser(libkb.LoadUserArg{
		Name:             v.user,
		RequirePublicKey: true,
		Self:             (len(v.user) == 0),
		LoadSecrets:      false,
		ForceReload:      false,
		SkipVerify:       false,
	})

	if err == nil {
		err = u.Identify()
	}

	return err
}

func NewCmdId(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:        "id",
		Usage:       "keybase id <username>",
		Description: "identify a user and check their proofs",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "assert, a",
				Usage: "a boolean expression on this identity",
			},
			cli.BoolFlag{
				Name:  "t, track-statement",
				Usage: "output a JSON a track statement for this user",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdId{}, "id", c)
		},
	}
}

func (v *CmdId) UseConfig() bool   { return true }
func (v *CmdId) UseKeyring() bool  { return true }
func (v *CmdId) UseAPI() bool      { return true }
func (v *CmdId) UseTerminal() bool { return false }

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
	luba      bool
	loadSelf  bool
}

func (v *CmdId) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	v.track = ctx.Bool("track-statement")
	v.luba = ctx.Bool("luba")
	v.loadSelf = ctx.Bool("load-self")
	if nargs == 1 {
		v.user = ctx.Args()[0]
	} else if nargs != 0 || v.luba {
		err = fmt.Errorf("id takes one arg -- the user to lookup")
	}
	return err
}

func (v *CmdId) Run() error {
	if v.luba {
		return v.RunLuba()
	} else {
		return v.RunStandard()
	}
}

func (v *CmdId) RunLuba() error {
	r := libkb.LoadUserByAssertions(v.user, v.loadSelf)
	if r.Error != nil {
		return r.Error
	} else {
		G.Log.Info("Success; loaded %s", r.User.GetName())
	}
	return nil
}

func (v *CmdId) RunStandard() error {

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
		if v.track {
			if jw, err := u.ToTrackingStatement(); err == nil {
				fmt.Println(jw.MarshalPretty())
			}
		}
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
			cli.BoolFlag {
				Name : "l, luba",
				Usage : "LookupUserByAssertion",
			},
			cli.BoolFlag {
				Name : "s, load-self",
				Usage : "Load self for tracking statement",
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

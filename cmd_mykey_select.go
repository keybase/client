package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdMykeySelect struct {
	arg   keyGenArg
	query string
}

func (v *CmdMykeySelect) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if err = v.arg.ParseArgv(ctx); err != nil {
	} else if nargs == 1 {
		v.query = ctx.Args()[0]
	} else if nargs != 0 {
		err = fmt.Errorf("mkey select takes 0 or 1 arguments")
	}
	return err
}

func (v *CmdMykeySelect) Run() error {
	gpg := G.GetGpgClient()
	if _, err := gpg.Configure(); err != nil {
		return err
	}
	if index, err, warns := gpg.Index(v.query); err != nil {
		return err
	} else {
		warns.Warn()
		fmt.Printf("%v\n", index)
	}
	return nil
}

func NewCmdMykeySelect(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:        "select",
		Usage:       "keybase mykey select [<key-query>]",
		Description: "Select a key as your own and push it to the server",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdMykeySelect{}, "select", c)
		},
	}
}

func (v *CmdMykeySelect) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
		Terminal:  true,
	}
}

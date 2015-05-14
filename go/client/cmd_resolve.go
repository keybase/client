package client

import (
	"fmt"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdResolve struct {
	input string
}

func (v *CmdResolve) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	if nargs == 1 {
		v.input = ctx.Args()[0]
	} else {
		err = fmt.Errorf("resolve takes one arg -- the name to resolve")
	}
	return err
}

func (v *CmdResolve) RunClient() error { return v.Run() }

func (v *CmdResolve) Run() error {
	res, err := libkb.LoadUser(libkb.LoadUserArg{Name: v.input})
	if err == nil {
		fmt.Println(res.GetName())
		fmt.Println(res.GetUID())
	}
	return err
}

func NewCmdResolve(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "resolve",
		Usage: "Resolve a foo@bar-style username to a keybase username",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdResolve{}, "resolve", c)
		},
	}
}

func (v *CmdResolve) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

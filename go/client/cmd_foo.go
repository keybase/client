// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CmdFoo struct {
	libkb.Contextified
	name string
}

func (c *CmdFoo) ParseArgv(ctx *cli.Context) error {
	c.name = ctx.String("name")
	if c.name == "" {
		return fmt.Errorf("--name required")
	}
	return nil
}

func (c *CmdFoo) Run() error {
	cli, err := GetFooClient(c.G())
	if err != nil {
		return err
	}

	err = cli.Foo(context.TODO(), keybase1.FooArg{
		Name: c.name,
	})
	if err != nil {
		return err
	}

	return nil
}

func NewCmdFoo(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	ret := cli.Command{
		Name:         "foo",
		ArgumentHelp: "",
		Usage:        "Run a test script on the service",
		Description:  GetFooDescription(),
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "n, name",
				Usage: "Name of script to run.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdFooRunner(g), "foo", c)
		},
	}
	return ret
}

func NewCmdFooRunner(g *libkb.GlobalContext) *CmdFoo {
	return &CmdFoo{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdFoo) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func GetFooDescription() string {
	desc := `
Run a hardcoded test script on the backend. For debugging. See the Foo engine.
`
	return strings.Join(strings.Split(strings.TrimSpace(desc), "\n"), "\n   ")
}

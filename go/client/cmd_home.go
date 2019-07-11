// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
	"strings"
)

type CmdHome struct {
	libkb.Contextified
	markViewed bool
	skipTodo   keybase1.HomeScreenTodoType
}

func (c *CmdHome) ParseArgv(ctx *cli.Context) error {
	c.markViewed = ctx.Bool("mark-viewed")
	s := ctx.String("skip-todo")
	if len(s) > 0 {
		var ok bool
		if c.skipTodo, ok = keybase1.HomeScreenTodoTypeMap[strings.ToUpper(s)]; !ok {
			return fmt.Errorf("unknown todo type: %s", s)
		}
	}
	return nil
}

func (c *CmdHome) Run() error {
	cli, err := GetHomeClient(c.G())
	if err != nil {
		return err
	}
	ctx := context.Background()
	if c.skipTodo != keybase1.HomeScreenTodoType_NONE {
		return c.doSkipTodo(ctx, cli)
	}
	return c.getHome(ctx, cli)
}

func (c *CmdHome) doSkipTodo(ctx context.Context, cli keybase1.HomeClient) error {
	return cli.HomeSkipTodoType(ctx, c.skipTodo)
}

func (c *CmdHome) getHome(ctx context.Context, cli keybase1.HomeClient) error {
	screen, err := cli.HomeGetScreen(ctx, keybase1.HomeGetScreenArg{MarkViewed: c.markViewed, NumFollowSuggestionsWanted: 10})
	if err != nil {
		return err
	}
	b, err := json.Marshal(screen)
	if err != nil {
		return err
	}
	return c.G().UI.GetTerminalUI().OutputDesc(OutputDescriptorHomeDump, string(b)+"\n")
}

func NewCmdHomeRunner(g *libkb.GlobalContext) *CmdHome {
	return &CmdHome{Contextified: libkb.NewContextified(g)}
}

func NewCmdHome(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "home",
		// hide
		// Usage: "Get and set the 'home' screen",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdHomeRunner(g), "home", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "mark-viewed",
				Usage: "Mark the home page as 'viewed'.",
			},
			cli.StringFlag{
				Name:  "skip-todo",
				Usage: "skip a category of home TODO items",
			},
		},
	}
}

func (c *CmdHome) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

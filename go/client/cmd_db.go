// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/base64"
	"errors"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
	"strconv"
)

type CmdDbNuke struct {
	libkb.Contextified
	force bool
}

func (c *CmdDbNuke) ParseArgv(ctx *cli.Context) error {
	c.force = ctx.Bool("force")
	return nil
}

func (c *CmdDbNuke) Run() error {
	var err error
	if !c.force {
		err = GlobUI.PromptForConfirmation("Really blast away your local database?")
	}
	if err == nil {
		cli, err := GetCtlClient(c.G())
		if err != nil {
			return err
		}
		if err = RegisterProtocolsWithContext(nil, c.G()); err != nil {
			return err
		}
		return cli.DbNuke(context.TODO(), 0)
	}
	return err
}

func NewCmdDbNuke(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "nuke",
		Usage: "Delete the local database",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdDbNukeRunner(g), "nuke", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "force, f",
				Usage: "Don't prompt.",
			},
		},
	}
}

func NewCmdDbNukeRunner(g *libkb.GlobalContext) *CmdDbNuke {
	return &CmdDbNuke{
		Contextified: libkb.NewContextified(g),
		force:        false,
	}
}

type CmdDbDelete struct {
	libkb.Contextified
	key keybase1.DbKey
}

func (c *CmdDbDelete) ParseArgv(ctx *cli.Context) error {
	var err error
	c.key, err = parseDbKey(ctx, 2, "delete needs 2 args: an 'object type' byte and a string key")
	return err
}

func parseDbKey(ctx *cli.Context, nargs int, usage string) (key keybase1.DbKey, err error) {
	key.DbType = keybase1.DbType_MAIN
	if ctx.Bool("chat") {
		key.DbType = keybase1.DbType_CHAT
	}
	if nargs != len(ctx.Args()) {
		return key, errors.New(usage)
	}
	key.ObjType, err = parseObjType(ctx.Args()[0])
	if err != nil {
		return key, err
	}
	key.Key = ctx.Args()[1]
	return key, nil
}

func parseObjType(s string) (int, error) {
	if len(s) > 2 && s[0:2] == "0x" {
		b, err := strconv.ParseUint(s[2:], 16, 8)
		if err != nil {
			return int(0), err
		}
		return int(b), nil
	}
	b, err := strconv.ParseUint(s, 10, 8)
	return int(b), err
}

func (c *CmdDbDelete) Run() error {
	cli, err := GetCtlClient(c.G())
	if err != nil {
		return err
	}
	return cli.DbDelete(context.TODO(), keybase1.DbDeleteArg{Key: c.key})
}

func NewCmdDbDeleteRunner(g *libkb.GlobalContext) *CmdDbDelete {
	return &CmdDbDelete{Contextified: libkb.NewContextified(g)}
}

func NewCmdDbDelete(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "delete",
		Usage:        "Delete a DB key/value pair",
		ArgumentHelp: "[obj-type] [key]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdDbDeleteRunner(g), "delete", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "chat, c",
				Usage: "Refer to the chat database.",
			},
		},
	}
}

type CmdDbGet struct {
	libkb.Contextified
	key    keybase1.DbKey
	base64 bool
}

func (c *CmdDbGet) ParseArgv(ctx *cli.Context) error {
	var err error
	c.base64 = ctx.Bool("base64")
	c.key, err = parseDbKey(ctx, 2, "get needs 2 args: an 'object type' byte and a string key")
	return err
}

func (c *CmdDbGet) Run() error {
	cli, err := GetCtlClient(c.G())
	if err != nil {
		return err
	}
	val, err := cli.DbGet(context.TODO(), keybase1.DbGetArg{Key: c.key})
	if err != nil {
		return err
	}
	if val == nil {
		c.G().UI.GetLogUI().Errorf("key not found")
		return nil
	}
	if *val == nil {
		c.G().UI.GetLogUI().Errorf("empty value")
		return nil
	}
	if c.base64 {
		ret := base64.StdEncoding.EncodeToString(*val)
		return c.G().UI.GetTerminalUI().Output(ret)
	}
	_, err = c.G().UI.GetTerminalUI().OutputWriter().Write(*val)
	return err
}

func NewCmdDbGetRunner(g *libkb.GlobalContext) *CmdDbGet {
	return &CmdDbGet{Contextified: libkb.NewContextified(g)}
}

func NewCmdDbGet(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "get",
		Usage:        "Get a DB value by key",
		ArgumentHelp: "[obj-type] [key]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdDbGetRunner(g), "get", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "chat, c",
				Usage: "Refer to the chat database.",
			},
			cli.BoolFlag{
				Name:  "base64, b",
				Usage: "Format output in base64.",
			},
		},
	}
}

type CmdDbPut struct {
	libkb.Contextified
	key keybase1.DbKey
	val keybase1.DbValue
}

func (c *CmdDbPut) ParseArgv(ctx *cli.Context) error {
	var err error
	c.key, err = parseDbKey(ctx, 3, "put needs 3 args: an 'object type' byte, a string key, and value to put")
	if err != nil {
		return err
	}
	raw := ctx.Args()[2]
	var val []byte
	if ctx.Bool("base64") {
		val, err = base64.StdEncoding.DecodeString(raw)
		if err != nil {
			return err
		}
	} else {
		val = []byte(raw)
	}
	c.val = keybase1.DbValue(val)
	return err
}

func (c *CmdDbPut) Run() error {
	cli, err := GetCtlClient(c.G())
	if err != nil {
		return err
	}
	return cli.DbPut(context.TODO(), keybase1.DbPutArg{Key: c.key, Value: c.val})
}

func NewCmdDbPutRunner(g *libkb.GlobalContext) *CmdDbPut {
	return &CmdDbPut{Contextified: libkb.NewContextified(g)}
}

func NewCmdDbPut(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "put",
		Usage:        "Put a DB value for the given key",
		ArgumentHelp: "[obj-type] [key] [value]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdDbPutRunner(g), "put", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "chat, c",
				Usage: "Refer to the chat database.",
			},
			cli.BoolFlag{
				Name:  "base64, b",
				Usage: "Format output in base64.",
			},
		},
	}
}

func NewCmdDb(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "db",
		Subcommands: []cli.Command{
			NewCmdDbNuke(cl, g),
			NewCmdDbDelete(cl, g),
			NewCmdDbGet(cl, g),
			NewCmdDbPut(cl, g),
		},
	}
}

func (c *CmdDbNuke) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdDbDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdDbGet) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdDbPut) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

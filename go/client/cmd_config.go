// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strconv"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdConfigGet struct {
	libkb.Contextified
	Path string
}

type CmdConfigSet struct {
	libkb.Contextified
	Path    string
	Value   keybase1.ConfigValue
	DoClear bool
}

type CmdConfigInfo struct {
	libkb.Contextified
}

func (v *CmdConfigGet) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) == 1 {
		v.Path = ctx.Args()[0]
	} else if len(ctx.Args()) > 1 {
		return fmt.Errorf("Expected 0 or 1 arguments")
	}
	return nil
}

func (v *CmdConfigSet) ParseArgv(ctx *cli.Context) error {
	flags := 0
	args := ctx.Args()

	if len(ctx.Args()) < 1 {
		return fmt.Errorf("Need 1 or more arguments for set")
	}

	v.Path = args[0]

	if ctx.Bool("clear") {
		flags++
		v.DoClear = true
	}
	if ctx.Bool("null") {
		flags++
		v.Value.IsNull = true
	}
	if ctx.Bool("int") {
		if len(args) <= 1 {
			return fmt.Errorf("Missing int value argument")
		}
		flags++
		i, err := strconv.ParseInt(args[1], 10, 64)
		if err != nil {
			return err
		}
		tmp := int(i)
		v.Value.I = &tmp
	}
	if ctx.Bool("bool") {
		if len(args) <= 1 {
			return fmt.Errorf("Missing bool value argument")
		}
		flags++
		b, err := strconv.ParseBool(args[1])
		if err != nil {
			return err
		}
		v.Value.B = &b
	}

	if ctx.Bool("obj") {
		if len(args) <= 1 {
			return fmt.Errorf("Missing obj value argument")
		}
		flags++
		s := args[1]
		v.Value.O = &s
	}

	if ctx.Bool("string") {
		flags++
	}

	if flags > 1 {
		return fmt.Errorf("Can only specify one of -c, -n, -i, -b or -s")
	}

	if ctx.Bool("string") || flags == 0 {
		if len(args) <= 1 {
			return fmt.Errorf("Missing string value argument")
		}
		s := args[1]
		if !ctx.IsSet("string") && v.looksLikeBool(s) {
			return fmt.Errorf("The value %q looks like a boolean value, not a string.  Use the -b flag to set a bool, or -s to confirm this is a string value.", s)
		}
		v.Value.S = &s
	}
	return nil
}

// like strconv.ParseBool, but without 0 and 1.
func (v *CmdConfigSet) looksLikeBool(s string) bool {
	switch s {
	case "t", "T", "true", "TRUE", "True":
		return true
	case "f", "F", "false", "FALSE", "False":
		return true
	}
	return false
}

func (v *CmdConfigInfo) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (v *CmdConfigGet) Run() error {
	cli, err := GetConfigClient(v.G())
	if err != nil {
		return err
	}
	var val keybase1.ConfigValue
	val, err = cli.GetValue(context.TODO(), v.Path)
	if err != nil {
		return err
	}
	dui := v.G().UI.GetDumbOutputUI()
	switch {
	case val.IsNull:
		dui.Printf("null\n")
	case val.I != nil:
		dui.Printf("%d\n", *val.I)
	case val.S != nil:
		dui.Printf("%q\n", *val.S)
	case val.B != nil:
		dui.Printf("%t\n", *val.B)
	case val.O != nil:
		dui.Printf("%s\n", *val.O)
	}

	return nil
}

func (v *CmdConfigSet) Run() error {
	cli, err := GetConfigClient(v.G())
	if err != nil {
		return err
	}
	if v.DoClear {
		err = cli.ClearValue(context.TODO(), v.Path)
	} else {
		err = cli.SetValue(context.TODO(), keybase1.SetValueArg{Path: v.Path, Value: v.Value})
	}
	return err
}

func (v *CmdConfigInfo) Run() error {
	configFile := v.G().Env.GetConfigFilename()
	v.G().UI.GetDumbOutputUI().Printf("%s\n", configFile)
	return nil
}

func NewCmdConfig(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "config",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdConfigGet(cl, g),
			NewCmdConfigSet(cl, g),
			NewCmdConfigInfo(cl, g),
		},
	}
}

func NewCmdConfigGetRunner(g *libkb.GlobalContext) *CmdConfigGet {
	return &CmdConfigGet{Contextified: libkb.NewContextified(g)}
}

func NewCmdConfigGet(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "get",
		Usage:        "Get a config value",
		ArgumentHelp: "<key>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdConfigGetRunner(g), "get", c)
		},
	}
}

func NewCmdConfigSet(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "set",
		Usage:        "Set a config value",
		ArgumentHelp: "<key> <value>",
		Description:  "Set a config value. Specify an empty value to clear it.",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "bool, b",
				Usage: "Treat the passed argument as a boolean",
			},
			cli.BoolFlag{
				Name:  "int, i",
				Usage: "Treat the passed argument as an integer",
			},
			cli.BoolFlag{
				Name:  "obj, o",
				Usage: "Treat the passed argument as a JSON object",
			},
			cli.BoolFlag{
				Name:  "string, s",
				Usage: "Treat the passed argument as a string (default)",
			},
			cli.BoolFlag{
				Name:  "null, n",
				Usage: "Set the value to null",
			},
			cli.BoolFlag{
				Name:  "clear, c",
				Usage: "Clear out the value",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdConfigSetRunner(g), "set", c)
		},
	}
}

func NewCmdConfigSetRunner(g *libkb.GlobalContext) *CmdConfigSet {
	return &CmdConfigSet{Contextified: libkb.NewContextified(g)}
}

func NewCmdConfigInfo(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "info",
		Usage: "Show config file path",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdConfigInfo{Contextified: libkb.NewContextified(g)}, "info", c)
		},
	}
}

func (v *CmdConfigGet) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
	}
}

func (v *CmdConfigSet) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
	}
}

func (v *CmdConfigInfo) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
	}
}

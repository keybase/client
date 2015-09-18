package client

import (
	"fmt"
	"io"
	"strconv"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdConfigGet struct {
	key    string
	writer io.Writer
}

type CmdConfigSet struct {
	key    string
	value  string
	writer io.Writer
}

type CmdConfigReset struct {
	writer io.Writer
}

type CmdConfigInfo struct {
	writer io.Writer
}

func (v *CmdConfigGet) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) < 1 {
		return fmt.Errorf("Not enough arguments.")
	}
	v.key = ctx.Args()[0]
	if v.writer == nil {
		v.writer = GlobUI.OutputWriter()
	}
	return nil
}

func (v *CmdConfigSet) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) < 1 {
		return fmt.Errorf("Not enough arguments.")
	}
	v.key = ctx.Args()[0]
	if len(ctx.Args()) > 1 {
		v.value = ctx.Args()[1]
	}
	if v.writer == nil {
		v.writer = GlobUI.OutputWriter()
	}
	return nil
}

func (v *CmdConfigReset) ParseArgv(ctx *cli.Context) error {
	if v.writer == nil {
		v.writer = GlobUI.OutputWriter()
	}
	return nil
}

func (v *CmdConfigInfo) ParseArgv(ctx *cli.Context) error {
	if v.writer == nil {
		v.writer = GlobUI.OutputWriter()
	}
	return nil
}

func (v *CmdConfigGet) Run() error {
	cr := G.Env.GetConfig()
	// TODO: print dictionaries?
	if s, isSet := cr.GetStringAtPath(v.key); isSet {
		fmt.Fprintf(v.writer, "%s: %s\n", v.key, s)
	} else if b, isSet := cr.GetBoolAtPath(v.key); isSet {
		fmt.Fprintf(v.writer, "%s: %t\n", v.key, b)
	} else if i, isSet := cr.GetIntAtPath(v.key); isSet {
		fmt.Fprintf(v.writer, "%s: %d\n", v.key, i)
	} else if isSet := cr.GetNullAtPath(v.key); isSet {
		fmt.Fprintf(v.writer, "%s: null\n", v.key)
	}
	return nil
}

func (v *CmdConfigSet) Run() error {
	if v.value != "" {
		cw := G.Env.GetConfigWriter()
		// try to convert the value to an int, and then to a bool
		// if those don't work, use a string
		if val, e := strconv.Atoi(v.value); e == nil {
			cw.SetIntAtPath(v.key, val)
		} else if val, e := strconv.ParseBool(v.value); e == nil {
			// NOTE: this will also convert strings like 't' and 'F' to
			// a bool, which could potentially cause strange errors for
			// e.g. a user named "f"
			cw.SetBoolAtPath(v.key, val)
		} else if v.value == "null" {
			cw.SetNullAtPath(v.key)
		} else {
			cw.SetStringAtPath(v.key, v.value)
		}
		cw.Write()
	} else {
		cw := G.Env.GetConfigWriter()
		cw.DeleteAtPath(v.key)
		cw.Write()
	}
	return nil
}

func (v *CmdConfigReset) Run() error {
	// Clear out file
	cw := G.Env.GetConfigWriter()
	cw.Reset()
	cw.Write()
	return nil
}

func (v *CmdConfigInfo) Run() error {
	configFile := G.Env.GetConfigFilename()
	fmt.Fprintf(v.writer, "%s\n", configFile)
	return nil
}

func NewCmdConfig(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "config",
		Usage:        "Get and set configuration options",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdConfigGet(cl),
			NewCmdConfigSet(cl),
			NewCmdConfigReset(cl),
			NewCmdConfigInfo(cl),
		},
	}
}

func NewCmdConfigGet(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "get",
		Usage:        "Get a config value",
		ArgumentHelp: "<key>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdConfigGet{}, "get", c)
		},
	}
}

func NewCmdConfigSet(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "set",
		Usage:        "Set a config value",
		ArgumentHelp: "<key> <value>",
		Description:  "Set a config value. Specify an empty value to clear it.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdConfigSet{}, "set", c)
		},
	}
}

func NewCmdConfigReset(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "reset",
		Usage: "Reset the config",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdConfigReset{}, "reset", c)
		},
	}
}

func NewCmdConfigInfo(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "info",
		Usage: "Show config file path",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdConfigInfo{}, "info", c)
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

func (v *CmdConfigReset) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
	}
}

func (v *CmdConfigInfo) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
	}
}

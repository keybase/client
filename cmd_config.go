package main

import (
	"errors"
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
	"io"
	"os"
	"strconv"
)

type CmdConfig struct {
	location bool
	reset    bool
	clear    bool
	key      string
	value    string
	valueSet bool
	writer   io.Writer
}

func (v *CmdConfig) ParseArgv(ctx *cli.Context) error {
	v.location = ctx.Bool("location")
	v.reset = ctx.Bool("reset")
	v.clear = ctx.Bool("clear")
	nargs := len(ctx.Args())
	if !v.location && !v.reset &&
		nargs != 1 && nargs != 2 {
		return errors.New("incorrect config usage")
	} else {
		if nargs > 0 {
			v.key = ctx.Args()[0]
		}
		if nargs > 1 {
			v.value = ctx.Args()[1]
			// distinguish between no value and an empty string
			v.valueSet = true
		}
	}

	if v.clear && (v.key == "" || v.valueSet) {
		return errors.New("--clear takes exactly one key and no value")
	}

	if v.writer == nil {
		v.writer = os.Stdout
	}

	return nil
}

func (v *CmdConfig) Run() error {
	if v.location {
		configFile := G.Env.GetConfigFilename()
		if v.reset || v.clear || v.key != "" {
			G.Log.Info(fmt.Sprintf("Using config file %s", configFile))
		} else {
			fmt.Fprintf(v.writer, "%s\n", configFile)
		}
	}

	if v.reset {
		// clear out file
		cw := G.Env.GetConfigWriter()
		cw.Reset()
		cw.Write()
		// continue on to get or set on cleared file
	}

	// TODO: validate user input?

	if v.key != "" {
		if v.valueSet {
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
		} else if v.clear {
			cw := G.Env.GetConfigWriter()
			cw.DeleteAtPath(v.key)
			cw.Write()
		} else {
			cr := G.Env.GetConfig()
			// TODO: print dictionaries?
			if s, is_set := cr.GetStringAtPath(v.key); is_set {
				fmt.Fprintf(v.writer, "%s: %s\n", v.key, s)
			} else if b, is_set := cr.GetBoolAtPath(v.key); is_set {
				fmt.Fprintf(v.writer, "%s: %t\n", v.key, b)
			} else if i, is_set := cr.GetIntAtPath(v.key); is_set {
				fmt.Fprintf(v.writer, "%s: %d\n", v.key, i)
			} else if is_set := cr.GetNullAtPath(v.key); is_set {
				fmt.Fprintf(v.writer, "%s: null\n", v.key)
			} else {
				G.Log.Info(fmt.Sprintf("%s does not map to a value", v.key))
			}
		}
	}

	return nil
}

func NewCmdConfig(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:  "config",
		Usage: "manage key/value pairs in the config file",
		Description: "A single argument reads a key; " +
			"two arguments set a key/value pair",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "location, l",
				Usage: "print config file location",
			},
			cli.BoolFlag{
				Name:  "reset, r",
				Usage: "clear entire existing config",
			},
			cli.BoolFlag{
				Name:  "clear, c",
				Usage: "delete a key",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdConfig{}, "config", c)
		},
	}
}

func (v *CmdConfig) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  false,
		API:        false,
		Terminal:   false,
	}
}

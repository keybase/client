// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/saltpack/encoding/basex"
	"io"
	"os"
)

type CmdBase62Decode struct {
	libkb.Contextified
}

func NewBase62DecodeRunner(g *libkb.GlobalContext) *CmdBase62Decode {
	return &CmdBase62Decode{
		Contextified: libkb.NewContextified(g),
	}
}

func NewCmdBase62(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "base62",
		Usage: "base62 operations",
		Subcommands: []cli.Command{
			NewCmdBase62Decode(cl, g),
		},
	}
}

func NewCmdBase62Decode(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "decode",
		Usage: "base62 decode",
		Flags: []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewBase62DecodeRunner(g), "decode", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func (v *CmdBase62Decode) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("No arguments allowed")
	}
	return nil
}

func (v *CmdBase62Decode) Run() error {
	_, err := io.Copy(os.Stdout, basex.NewDecoder(basex.Base62StdEncoding, os.Stdin))
	return err
}

func (v *CmdBase62Decode) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"io"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/saltpack/encoding/basex"
)

func NewCmdBase62(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "base62",
		Usage: "base62 operations",
		Subcommands: []cli.Command{
			NewCmdBase62Decode(cl, g),
			NewCmdBase62Encode(cl, g),
		},
	}
}

type CmdBase62Decode struct {
	libkb.Contextified
}

func NewBase62DecodeRunner(g *libkb.GlobalContext) *CmdBase62Decode {
	return &CmdBase62Decode{
		Contextified: libkb.NewContextified(g),
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

type CmdBase62Encode struct {
	libkb.Contextified
}

func NewBase62EncodeRunner(g *libkb.GlobalContext) *CmdBase62Encode {
	return &CmdBase62Encode{
		Contextified: libkb.NewContextified(g),
	}
}

func NewCmdBase62Encode(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "encode",
		Usage: "base62 encode",
		Flags: []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewBase62EncodeRunner(g), "encode", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func (v *CmdBase62Encode) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("No arguments allowed")
	}
	return nil
}

func (v *CmdBase62Encode) Run() error {
	enc := basex.NewEncoder(basex.Base62StdEncoding, os.Stdout)
	_, err := io.Copy(enc, os.Stdin)
	if err != nil {
		return err
	}
	err = enc.Close()
	return err
}

func (v *CmdBase62Encode) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

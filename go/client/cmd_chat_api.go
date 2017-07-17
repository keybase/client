// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"io"
	"os"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type CmdChatAPI struct {
	libkb.Contextified
	indent     bool
	inputFile  string
	outputFile string
	message    string
}

func newCmdChatAPI(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "api",
		Usage: "JSON api",
		Action: func(c *cli.Context) {
			cmd := NewCmdChatAPIRunner(g)
			cl.ChooseCommand(cmd, "api", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "p, pretty",
				Usage: "Output pretty (indented) JSON.",
			},
			cli.StringFlag{
				Name:  "m",
				Usage: "Specify JSON as string instead of stdin",
			},
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify JSON input file (stdin default)",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify output file (stdout default)",
			},
		},
		Description: chatAPIDoc,
	}
}

func (c *CmdChatAPI) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("api takes no arguments")
	}
	c.indent = ctx.Bool("pretty")
	c.inputFile = ctx.String("infile")
	c.outputFile = ctx.String("outfile")
	c.message = ctx.String("m")

	if len(c.message) > 0 && len(c.inputFile) > 0 {
		return errors.New("specify -m or -i, but not both")
	}

	return nil
}

func (c *CmdChatAPI) Run() error {
	h := newChatServiceHandler(c.G())
	d := NewChatAPIDecoder(&ChatAPI{svcHandler: h, indent: c.indent})

	var r io.Reader
	r = os.Stdin
	if len(c.message) > 0 {
		r = strings.NewReader(c.message)
	} else if len(c.inputFile) > 0 {
		f, err := os.Open(c.inputFile)
		if err != nil {
			return err
		}
		defer f.Close()
		r = f
	}

	var w io.Writer
	w = os.Stdout
	if len(c.outputFile) > 0 {
		f, err := os.Create(c.outputFile)
		if err != nil {
			return err
		}
		defer f.Close()
		w = f
	}

	if err := d.Decode(context.Background(), r, w); err != nil {
		return err
	}

	return nil
}

func NewCmdChatAPIRunner(g *libkb.GlobalContext) *CmdChatAPI {
	return &CmdChatAPI{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdChatAPI) SetMessage(m string) {
	c.message = m
}

func (c *CmdChatAPI) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func NewCmdOneshot(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.StringFlag{
			Name : "p, paperkey",
			Usage : "specify a paper key (or try the KEYBASE_PAPERKEY environment variable)",
		},
		cli.StringFlag{
			Name : "u,username",
			Usage : "specify a username (or try the KEYBASE_USERNAME environment variable)",
		},
	}
	cmd := cli.Command{
		Name:         "oneshot",
		Usage:        "Establish a oneshot device, as in logging into keybase from a disposable docker",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdOneshotRunner(g), "oneshot", c)
			cl.SetNoStandalone()
		},
		Flags: flags,
	}
	return cmd
}

type CmdOneshot struct {
	libkb.Contextified
	Username   string
	PaperKey   string
}

func NewCmdOneshotRunner(g *libkb.GlobalContext) *CmdOneshot {
	return &CmdOneshot{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdOneshot) Run() error {
	protocols := []rpc.Protocol{}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	client, err := GetLoginClient(c.G())
	if err != nil {
		return err
	}

	err = client.LoginOneshot(context.Background(), keybase1.LoginOneshotArg{SessionID : 0, Username : c.Username, PaperKey : c.PaperKey })
	return err
}

func (c *CmdOneshot) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if nargs != 0 {
		return errors.New("didn't expect any arguments")
	}
	c.Username, err = c.getOption(ctx, "username")
	if err != nil {
		return err
	}
	c.PaperKey, err = c.getOption(ctx, "paperkey")
	if err != nil {
		return err
	}
	return nil
}

func (c *CmdOneshot) getOption(ctx *cli.Context, s string) (string, error) {
	v := ctx.String(s)
	if len(v) > 0 {
		return v, nil
	}
	envVarName := fmt.Sprintf("KEYBASE_%s", strings.ToUpper(s))
	v = os.Getenv(envVarName)
	if len(v) > 0 {
		return v, nil
	}
	return "", fmt.Errorf("Need a --%s option or a %s environment variable", s, envVarName)
}

func (c *CmdOneshot) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    false,
		KbKeyring: false,
		API:       false,
	}
}

// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"regexp"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/auth"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type CmdCA struct {
	libkb.Contextified
}

func (c *CmdCA) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdCA) Run() error {
	return c.runPromptLoop()
}

func (c *CmdCA) runPromptLoop() error {
	var err error
	var s string
	re := regexp.MustCompile(`(\s|,|:)+`)

	api := auth.NewUserKeyAPIer(c.G().Log, c.G().API)
	ca := auth.NewCredentialAuthority(c.G().Log, api)

	for {
		s, err = c.G().UI.GetTerminalUI().Prompt(0, "ca> ")
		if err != nil {
			break
		}
		s = strings.TrimSpace(s)
		if len(s) == 0 {
			break
		}
		v := re.Split(s, -1)
		if len(v) != 3 {
			c.G().Log.Errorf("Need a triple: [<uid>,<username>,<kid>]")
			continue
		}

		uid, e2 := keybase1.UIDFromString(v[0])
		if e2 != nil {
			c.G().Log.Errorf("Bad UID %s: %s", v[0], e2)
			continue
		}

		un := libkb.NewNormalizedUsername(v[1])

		kid, e2 := keybase1.KIDFromStringChecked(v[2])
		if e2 != nil {
			c.G().Log.Errorf("Bad KID %s: %s", v[2], e2)
			continue
		}

		if e2 := ca.CheckUserKey(context.TODO(), uid, &un, &kid); e2 != nil {
			c.G().Log.Errorf("Bad check: %s", e2)
		}

	}
	return err
}

func NewCmdCA(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:        "ca",
		Description: "Query the server about whether keys are valid for given users",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCA{Contextified: libkb.NewContextified(g)}, "show-notifications", c)
		},
		Flags: []cli.Flag{},
	}
}

func (c *CmdCA) GetUsage() libkb.Usage {
	return libkb.Usage{API: true}
}

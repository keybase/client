// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"strconv"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type cmdTeamFTL struct {
	libkb.Contextified
	arg keybase1.FastTeamLoadArg
}

func newCmdTeamFTL(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "ftl",
		Description:  "trigger FTL (fast team loader) for debugging",
		ArgumentHelp: "id",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "Force reload, as if it's been an hour since the last reload",
			},
			cli.StringFlag{
				Name:  "g, gens",
				Usage: "Which generation(s) to request; if multiple, then comma-separate them",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdTeamFTL{Contextified: libkb.NewContextified(g)}, "ftl", c)
		},
	}
}

func (c *cmdTeamFTL) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}
	res, err := cli.Ftl(context.TODO(), c.arg)
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Printf("%+v\n", res)
	return nil
}

func (c *cmdTeamFTL) parseTeamGenerations(s string) (gens []keybase1.PerTeamKeyGeneration, err error) {
	v := strings.Split(s, ",")
	for _, e := range v {
		i, err := strconv.Atoi(e)
		if err != nil {
			return nil, err
		}
		gens = append(gens, keybase1.PerTeamKeyGeneration(i))
	}
	return gens, nil
}

func (c *cmdTeamFTL) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("need a team ID argument")
	}
	var err error
	c.arg.ID, err = keybase1.TeamIDFromString(ctx.Args()[0])
	if err != nil {
		return err
	}

	c.arg.ForceRefresh = ctx.Bool("force")
	s := ctx.String("gens")
	if len(s) > 0 {
		c.arg.KeyGenerationsNeeded, err = c.parseTeamGenerations(s)
		if err != nil {
			return err
		}
	} else {
		c.arg.NeedLatestKey = true
	}
	c.arg.Applications = []keybase1.TeamApplication{keybase1.TeamApplication_CHAT}

	return nil
}

func (c *cmdTeamFTL) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

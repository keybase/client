// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type cmdUPAK struct {
	libkb.Contextified
	uid  keybase1.UID
	kid  keybase1.KID
	lite bool
}

func NewCmdUPAK(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "upak",
		Description:  "Dump a UPAK",
		ArgumentHelp: "uid",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "k, kid",
				Usage: "KID to query",
			},
			cli.BoolFlag{
				Name:  "l, lite",
				Usage: "Get a trimmed down UPAK",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdUPAK{Contextified: libkb.NewContextified(g)}, "upak", c)
		},
	}
}

func (c *cmdUPAK) Run() error {
	userClient, err := GetUserClient(c.G())
	if err != nil {
		return err
	}
	if err = RegisterProtocolsWithContext(nil, c.G()); err != nil {
		return err
	}

	if c.lite {
		upakLite, err := userClient.GetUPAKLite(context.Background(), c.uid)
		if err != nil {
			return err
		}
		jsonOut, err := json.MarshalIndent(upakLite, "", "  ")
		if err != nil {
			return err
		}
		c.G().UI.GetTerminalUI().Output(string(jsonOut) + "\n")
		return nil
	}

	res, err := userClient.GetUPAK(context.Background(), c.uid)
	if err != nil {
		return err
	}
	jsonOut, err := json.Marshal(res)
	if err != nil {
		return err
	}
	if !c.kid.IsNil() {
		v, err := res.V()
		if err != nil {
			return err
		}
		if v != keybase1.UPAKVersion_V2 {
			return fmt.Errorf("didn't get UPAK v2")
		}
		upk2, _ := res.V2().FindKID(c.kid)
		if upk2 == nil {
			return fmt.Errorf("key %s wasn't found", c.kid)
		}
	}

	c.G().UI.GetTerminalUI().Output(string(jsonOut) + "\n")
	return nil
}

func (c *cmdUPAK) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("need a UID argument")
	}
	var err error
	c.uid, err = keybase1.UIDFromString(ctx.Args()[0])
	if err != nil {
		return err
	}
	kid := ctx.String("kid")
	c.lite = ctx.Bool("lite")
	if len(kid) > 0 {
		c.kid, err = keybase1.KIDFromStringChecked(kid)
		if err != nil {
			return err
		}
	}
	return nil
}

func (c *cmdUPAK) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

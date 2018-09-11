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

type modeFNMR int

const (
	modeFNMRNone   modeFNMR = 0
	modeFNMRRevoke modeFNMR = 1
	modeFNMRReset  modeFNMR = 2
)

type cmdFNMR struct {
	libkb.Contextified
	mode  modeFNMR
	uid   keybase1.UID
	seqno keybase1.Seqno
	upak  keybase1.UPAKVersioned
}

func NewCmdFNMR(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "fnmr",
		Description:  "Find next merkle Root",
		ArgumentHelp: "uid",
		Flags: []cli.Flag{
			cli.IntFlag{
				Name:  "revoke,k",
				Usage: "sequence # of the revoke to query",
			},
			cli.IntFlag{
				Name:  "reset,r",
				Usage: "sequence # of the reset to query",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdFNMR{Contextified: libkb.NewContextified(g)}, "fnmr", c)
		},
	}
}

func (c *cmdFNMR) runRevoke(ctx context.Context, cli keybase1.UserClient) error {
	v, err := c.upak.V()
	if err != nil {
		return err
	}
	if v != keybase1.UPAKVersion_V2 {
		return fmt.Errorf("wanted V2 upak, got something else")
	}
	var devKey *keybase1.PublicKeyV2NaCl
	for _, i := range c.upak.V2().AllIncarnations() {
		for _, k := range i.DeviceKeys {
			if k.Base.Revocation != nil && k.Base.IsSibkey && k.Base.Revocation.SigChainLocation.Seqno == c.seqno {
				tmp := k
				devKey = &tmp
			}
		}
	}
	if devKey == nil {
		return fmt.Errorf("can't find device key for revocation")
	}
	c.G().Log.CDebugf(ctx, "Found device key: %+v", *devKey)
	revk := devKey.Base.Revocation
	res, err := cli.FindNextMerkleRootAfterRevoke(ctx, keybase1.FindNextMerkleRootAfterRevokeArg{
		Uid:  c.uid,
		Kid:  devKey.Base.Kid,
		Loc:  revk.SigChainLocation,
		Prev: revk.PrevMerkleRootSigned,
	})
	if err != nil {
		return err
	}
	jsonOut, err := json.Marshal(res)
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Output(string(jsonOut) + "\n")
	return nil
}

func (c *cmdFNMR) runReset(ctx context.Context, cli keybase1.UserClient) error {
	v, err := c.upak.V()
	if err != nil {
		return err
	}
	if v != keybase1.UPAKVersion_V2 {
		return fmt.Errorf("wanted V2 upak, got something else")
	}
	var reset *keybase1.ResetSummary
	for _, i := range c.upak.V2().AllIncarnations() {
		if i.Reset != nil && i.Reset.ResetSeqno == c.seqno {
			tmp := *i.Reset
			reset = &tmp
		}
	}
	if reset == nil {
		return fmt.Errorf("can't find device key for revocation")
	}
	c.G().Log.CDebugf(ctx, "Found reset summary: %+v", *reset)
	res, err := cli.FindNextMerkleRootAfterReset(ctx, keybase1.FindNextMerkleRootAfterResetArg{
		Uid:        c.uid,
		ResetSeqno: c.seqno,
		Prev:       reset.MerkleRoot,
	})
	if err != nil {
		return err
	}
	jsonOut, err := json.Marshal(res)
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Output(string(jsonOut) + "\n")
	return nil
}

func (c *cmdFNMR) Run() error {
	userClient, err := GetUserClient(c.G())
	if err != nil {
		return err
	}
	ctx := context.Background()

	c.upak, err = userClient.GetUPAK(ctx, c.uid)
	if err != nil {
		return err
	}

	switch c.mode {
	case modeFNMRRevoke:
		return c.runRevoke(ctx, userClient)
	case modeFNMRReset:
		return c.runReset(ctx, userClient)
	default:
		return fmt.Errorf("No operation mode found; try one of: {-r}")
	}
}

func (c *cmdFNMR) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("need a UID argument")
	}
	var err error
	c.uid, err = keybase1.UIDFromString(ctx.Args()[0])
	if err != nil {
		return err
	}
	i := ctx.Int("revoke")
	if i > 0 {
		c.mode = modeFNMRRevoke
		c.seqno = keybase1.Seqno(i)
	}
	i = ctx.Int("reset")
	if i > 0 {
		c.mode = modeFNMRReset
		c.seqno = keybase1.Seqno(i)
	}
	return nil
}

func (c *cmdFNMR) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

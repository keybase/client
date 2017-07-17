// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CmdScanProofs struct {
	libkb.Contextified
	infile     string
	indices    string
	sigid      string
	ratelimit  int
	cachefile  string
	ignorefile string
}

func (c *CmdScanProofs) ParseArgv(ctx *cli.Context) error {
	c.infile = ctx.String("infile")
	if len(c.infile) == 0 {
		return fmt.Errorf("Infile required")
	}
	c.indices = ctx.String("indices")
	c.sigid = ctx.String("sigid")
	c.ratelimit = ctx.Int("ratelimit")
	if !ctx.IsSet("ratelimit") {
		c.ratelimit = 500
	}
	c.cachefile = ctx.String("cachefile")
	c.ignorefile = ctx.String("ignorefile")
	return nil
}

func (c *CmdScanProofs) Run() error {
	cli, err := GetScanProofsClient(c.G())
	if err != nil {
		return err
	}

	err = cli.ScanProofs(context.TODO(), keybase1.ScanProofsArg{
		Infile:     c.infile,
		Indices:    c.indices,
		Sigid:      c.sigid,
		Ratelimit:  c.ratelimit,
		Cachefile:  c.cachefile,
		Ignorefile: c.ignorefile,
	})
	if err != nil {
		return err
	}

	return nil
}

func NewCmdScanProofs(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	ret := cli.Command{
		Name:         "scan-proofs",
		ArgumentHelp: "",
		Usage:        "Test proof validation on many users.",
		Description:  GetScanProofsDescription(),
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify an input file.",
			},
			cli.StringFlag{
				Name:  "w, indices",
				Usage: "Only check in this range of indices. (like 2:8).",
			},
			cli.StringFlag{
				Name:  "s, sigid",
				Usage: "Only check this sigid.",
			},
			cli.IntFlag{
				Name:  "r, ratelimit",
				Usage: "Check 1 proof every n milliseconds. Defaults to 500",
			},
			cli.StringFlag{
				Name:  "c, cachefile",
				Usage: "Specify a file to use as a cache.",
			},
			cli.StringFlag{
				Name:  "g, ignorefile",
				Usage: "Specify a file containing a list of sigids to ignore.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdScanProofsRunner(g), "scan-proofs", c)
		},
	}
	return ret
}

func NewCmdScanProofsRunner(g *libkb.GlobalContext) *CmdScanProofs {
	return &CmdScanProofs{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdScanProofs) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func GetScanProofsDescription() string {
	desc := `
Check that this client and the server agree about a list of proofs.

Takes as input a file containing a database dump of existing proofs with their server state.
The input file is a csv of the result of this query:
https://github.com/keybase/keybase/blob/master/notes/scan-proofs.md

Using a cache file will remember when successful agreements, speeding up
subsequent runs of scan-proofs on the same proofs.

An ignore file can be supplied which contains a list of sig ids to skip checking.
The ignore file should be a list of sigids, one per line, with optional comments
starting with "//".
`
	return strings.Join(strings.Split(strings.TrimSpace(desc), "\n"), "\n   ")
}

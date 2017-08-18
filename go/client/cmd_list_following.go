// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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

type CmdListTracking struct {
	libkb.Contextified
	assertion string
	filter    string
	json      bool
	verbose   bool
	headers   bool
}

func (s *CmdListTracking) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) == 1 {
		s.assertion = ctx.Args()[0]
	} else if len(ctx.Args()) > 1 {
		return fmt.Errorf("list-following takes at most one argument")
	}

	s.json = ctx.Bool("json")
	s.verbose = ctx.Bool("verbose")
	s.headers = ctx.Bool("headers")
	s.filter = ctx.String("filter")

	return nil
}

func displayTable(entries []keybase1.UserSummary, verbose bool, headers bool) (err error) {
	if verbose {
		noun := "users"
		if len(entries) == 1 {
			noun = "user"
		}
		GlobUI.Printf("Following %d %s:\n\n", len(entries), noun)
	}

	var cols []string

	if headers {
		if verbose {
			cols = []string{
				"Username",
				"Sig ID",
				"PGP fingerprints",
				"When Followed",
				"Proofs",
			}
		} else {
			cols = []string{"Username"}
		}
	}

	i := 0
	rowfunc := func() []string {
		if i >= len(entries) {
			return nil
		}
		entry := entries[i]
		i++

		if !verbose {
			return []string{entry.Username}
		}

		fps := make([]string, len(entry.Proofs.PublicKeys))
		for i, k := range entry.Proofs.PublicKeys {
			if k.PGPFingerprint != "" {
				fps[i] = k.PGPFingerprint
			}
		}

		row := []string{
			entry.Username,
			entry.SigIDDisplay,
			strings.Join(fps, ", "),
			keybase1.FormatTime(entry.TrackTime),
		}
		for _, proof := range entry.Proofs.Social {
			row = append(row, proof.IdString)
		}
		return row
	}

	GlobUI.Tablify(cols, rowfunc)
	return
}

func DisplayJSON(jsonStr string) error {
	_, err := GlobUI.Println(jsonStr)
	return err
}

func (s *CmdListTracking) Run() error {
	cli, err := GetUserClient(s.G())
	if err != nil {
		return err
	}

	if s.json {
		jsonStr, err := cli.ListTrackingJSON(context.TODO(), keybase1.ListTrackingJSONArg{
			Assertion: s.assertion,
			Filter:    s.filter,
			Verbose:   s.verbose,
		})
		if err != nil {
			return err
		}
		return DisplayJSON(jsonStr)
	}

	table, err := cli.ListTracking(context.TODO(), keybase1.ListTrackingArg{Filter: s.filter, Assertion: s.assertion})
	if err != nil {
		return err
	}
	return displayTable(table, s.verbose, s.headers)
}

func NewCmdListTracking(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "list-following",
		ArgumentHelp: "<username>",
		Usage:        "List who you or the given user is following",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdListTracking{Contextified: libkb.NewContextified(g)}, "following", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "f, filter",
				Usage: "Provide a regex filter.",
			},
			cli.BoolFlag{
				Name:  "H, headers",
				Usage: "Show column headers.",
			},
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output as JSON (default is text).",
			},
			cli.BoolFlag{
				Name:  "v, verbose",
				Usage: "A full dump, with more gory details.",
			},
		},
	}
}

func (s *CmdListTracking) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

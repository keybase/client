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

type CmdSigsList struct {
	libkb.Contextified

	filter  string
	revoked bool
	json    bool
	verbose bool
	allKeys bool
	headers bool
	types   map[string]bool

	username string

	user  *libkb.User
	sigs  []libkb.TypedChainLink
	ksigs []keybase1.Sig
}

func (s *CmdSigsList) ParseTypes(ctx *cli.Context) error {
	tmp := ctx.String("type")
	if len(tmp) == 0 {
		return nil
	}

	types := map[string]bool{
		"follow":         true,
		"proof":          true,
		"cryptocurrency": true,
		"self":           true,
	}

	ret := make(map[string]bool)
	v := strings.Split(tmp, ",")
	for _, i := range v {
		ok, found := types[i]
		if !ok || !found {
			return fmt.Errorf("Unknown signature type: %s", i)
		}
		ret[i] = true
	}
	s.types = ret
	return nil
}

func (s *CmdSigsList) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.revoked = ctx.Bool("revoked")
	s.json = ctx.Bool("json")
	s.verbose = ctx.Bool("verbose")
	s.allKeys = ctx.Bool("all-keys")
	s.headers = ctx.Bool("headers")
	s.filter = ctx.String("filter")

	if err = s.ParseTypes(ctx); err != nil {
		return err
	}

	if nargs == 1 {
		s.username = ctx.Args()[0]
	} else if nargs > 1 {
		err = fmt.Errorf("List takes at most 1 arg, a username.")
	}

	return err
}

func (s *CmdSigsList) DisplayKTable(sigs []keybase1.Sig) (err error) {
	if sigs == nil {
		return nil
	}

	var cols []string

	if s.headers {
		cols = []string{
			"#",
			"SigId",
			"Type",
			"Date",
		}
		if s.revoked {
			cols = append(cols, "Revoked")
		}
		if s.allKeys {
			cols = append(cols, "Active", "Key")
		}
		cols = append(cols, "Body")
	}

	i := 0

	rowfunc := func() []string {
		var row []string
		for ; i < len(sigs) && row == nil; i++ {
			link := sigs[i]
			row = []string{
				fmt.Sprintf("%d", link.Seqno),
				link.SigIDDisplay,
				link.Type,
				keybase1.FormatTime(link.CTime),
			}
			if s.revoked {
				var ch string
				if link.Revoked {
					ch = "R"
				} else {
					ch = "."
				}
				row = append(row, ch)
			}
			if s.allKeys {
				var ch string
				if link.Active {
					ch = "+"
				} else {
					ch = "-"
				}
				row = append(row, ch, link.Key)
			}
			row = append(row, link.Body)
		}
		return row
	}

	libkb.Tablify(s.G().UI.GetTerminalUI().OutputWriter(), cols, rowfunc)

	return
}

func (s *CmdSigsList) Run() error {
	cli, err := GetSigsClient(s.G())
	if err != nil {
		return err
	}
	var t *keybase1.SigTypes
	if s.types != nil {
		t = &keybase1.SigTypes{
			Track:          s.types["follow"],
			Proof:          s.types["proof"],
			Cryptocurrency: s.types["cryptocurrency"],
			IsSelf:         s.types["self"],
		}
	}
	args := keybase1.SigListArgs{
		Username: s.username,
		AllKeys:  s.allKeys,
		Filterx:  s.filter,
		Verbose:  s.verbose,
		Revoked:  s.revoked,
		Types:    t,
	}

	if s.json {
		json, err := cli.SigListJSON(context.TODO(), keybase1.SigListJSONArg{Arg: args})
		if err != nil {
			return err
		}
		s.G().UI.GetTerminalUI().Output(json)
		return nil
	}

	sigs, err := cli.SigList(context.TODO(), keybase1.SigListArg{Arg: args})
	if err != nil {
		return err
	}
	return s.DisplayKTable(sigs)
}

func NewCmdSigsList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "list",
		Usage:        "List signatures",
		ArgumentHelp: "[username]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSigsList{Contextified: libkb.NewContextified(g)}, "list", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "r, revoked",
				Usage: "Include revoked signatures.",
			},
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output as JSON (default is text).",
			},
			cli.BoolFlag{
				Name:  "v, verbose",
				Usage: "A full dump, with more gory details.",
			},
			cli.StringFlag{
				Name:  "t, type",
				Usage: "Type of sig to output: follow, proof, cryptocurrency, self, all (default is all).",
			},
			cli.BoolFlag{
				Name:  "a, all-keys",
				Usage: "Show signatures from all (replaced) keys.",
			},
			cli.BoolFlag{
				Name:  "H, headers",
				Usage: "Show column headers.",
			},
			cli.StringFlag{
				Name:  "f, filter",
				Usage: "Provide a regex filter.",
			},
		},
	}
}

func (s *CmdSigsList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

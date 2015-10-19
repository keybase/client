package client

import (
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type CmdListTracking struct {
	filter  string
	json    bool
	verbose bool
	headers bool
	user    *libkb.User
}

func (s *CmdListTracking) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.json = ctx.Bool("json")
	s.verbose = ctx.Bool("verbose")
	s.headers = ctx.Bool("headers")
	s.filter = ctx.String("filter")

	if nargs > 0 {
		err = fmt.Errorf("List tracking doesn't take any arguments.")
	}

	return err
}

func displayTable(entries []keybase1.UserSummary, verbose bool, headers bool) (err error) {
	if verbose {
		noun := "users"
		if len(entries) == 1 {
			noun = "user"
		}
		GlobUI.Printf("Tracking %d %s:\n\n", len(entries), noun)
	}

	var cols []string

	if headers {
		if verbose {
			cols = []string{
				"Username",
				"Sig ID",
				"PGP fingerprints",
				"When Tracked",
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
	cli, err := GetUserClient()
	if err != nil {
		return err
	}

	if s.json {
		jsonStr, err := cli.ListTrackingJSON(context.TODO(), keybase1.ListTrackingJSONArg{
			Filter:  s.filter,
			Verbose: s.verbose,
		})
		if err != nil {
			return err
		}
		return DisplayJSON(jsonStr)
	}

	table, err := cli.ListTracking(context.TODO(), keybase1.ListTrackingArg{Filter: s.filter})
	if err != nil {
		return err
	}
	return displayTable(table, s.verbose, s.headers)
}

func NewCmdListTracking(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "list-tracking",
		Usage: "List who you're tracking",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdListTracking{}, "tracking", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output as JSON (default is text).",
			},
			cli.BoolFlag{
				Name:  "v, verbose",
				Usage: "A full dump, with more gory details.",
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

func (s *CmdListTracking) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

package client

import (
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
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
		err = fmt.Errorf("list tracking takes no args")
	}

	return err
}

func DisplayTable(entries []keybase1.UserSummary, verbose bool, headers bool) (err error) {
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
			libkb.FormatTime(time.Unix(entry.TrackTime, 0)),
		}
		for _, proof := range entry.Proofs.Social {
			row = append(row, proof.IdString)
		}
		return row
	}

	libkb.Tablify(os.Stdout, cols, rowfunc)
	return
}

func DisplayJSON(jsonStr string) (err error) {
	_, err = io.WriteString(os.Stdout, jsonStr+"\n")
	return
}

func (s *CmdListTracking) RunClient() error {
	cli, err := GetUserClient()
	if err != nil {
		return err
	}

	if s.json {
		jsonStr, err := cli.ListTrackingJSON(keybase1.ListTrackingJSONArg{
			Filter:  s.filter,
			Verbose: s.verbose,
		})
		if err != nil {
			return err
		}
		return DisplayJSON(jsonStr)
	}

	table, err := cli.ListTracking(s.filter)
	if err != nil {
		return err
	}
	return DisplayTable(table, s.verbose, s.headers)
}

func (s *CmdListTracking) Run() (err error) {
	arg := engine.ListTrackingEngineArg{
		Json:    s.json,
		Verbose: s.verbose,
		Filter:  s.filter,
	}
	eng := engine.NewListTrackingEngine(&arg, G)
	ctx := engine.Context{}
	err = engine.RunEngine(eng, &ctx)
	if err != nil {
		return
	}

	if s.json {
		err = DisplayJSON(eng.JSONResult())
	} else {
		err = DisplayTable(eng.TableResult(), s.verbose, s.headers)
	}
	return
}

func NewCmdListTracking(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "tracking",
		Usage:       "keybase list tracking",
		Description: "list who you're tracking",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdListTracking{}, "tracking", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "output in json format; default is text",
			},
			cli.BoolFlag{
				Name:  "v, verbose",
				Usage: "a full dump, with more gory detail",
			},
			cli.BoolFlag{
				Name:  "H, headers",
				Usage: "show column headers",
			},
			cli.StringFlag{
				Name:  "f, filter",
				Usage: "provide a regex filter",
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

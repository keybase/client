// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// CmdSimpleFSQuota is the 'fs quota' command.
type CmdSimpleFSQuota struct {
	libkb.Contextified
	git      bool
	bytes    bool
	archived bool
	json     bool
	teamName keybase1.TeamName
}

// NewCmdSimpleFSQuota creates a new cli.Command.
func NewCmdSimpleFSQuota(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "quota",
		Usage: "show quota usage for logged-in user or a team",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(
				&CmdSimpleFSQuota{Contextified: libkb.NewContextified(g)},
				"quota", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "git",
				Usage: "show git usage",
			},
			cli.BoolFlag{
				Name:  "bytes",
				Usage: "show all data in units of bytes",
			},
			cli.BoolFlag{
				Name:  "archived",
				Usage: "show archived usage",
			},
			cli.BoolFlag{
				Name:  "json",
				Usage: "show output in json format",
			},
			cli.StringFlag{
				Name:  "team",
				Usage: "print quota usage for a team, instead of the logged-in user",
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSQuota) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	var usage keybase1.SimpleFSQuotaUsage
	if c.teamName.Depth() == 0 {
		usage, err = cli.SimpleFSGetUserQuotaUsage(context.TODO())
	} else {
		usage, err = cli.SimpleFSGetTeamQuotaUsage(context.TODO(), c.teamName)
	}
	if err != nil {
		return err
	}

	return c.output(usage)
}

func humanizeBytes(n int64, bytesOnly bool) string {
	const kb = 1024
	const kbf = float64(kb)
	const mb = kb * 1024
	const mbf = float64(mb)
	const gb = mb * 1024
	const gbf = float64(gb)
	if bytesOnly || n < kb {
		return fmt.Sprintf("%d bytes", n)
	} else if n < mb {
		return fmt.Sprintf("%.2f KB", float64(n)/kbf)
	} else if n < gb {
		return fmt.Sprintf("%.2f MB", float64(n)/mbf)
	}
	return fmt.Sprintf("%.2f GB", float64(n)/gbf)
}

func (c *CmdSimpleFSQuota) humanizeBytes(n int64) string {
	return humanizeBytes(n, c.bytes)
}

type simpleFSQuotaStruct struct {
	UsageBytes    int64
	ArchivedBytes int64 `json:",omitempty"`
	QuotaBytes    int64
}

func (c *CmdSimpleFSQuota) output(usage keybase1.SimpleFSQuotaUsage) error {
	ui := c.G().UI.GetTerminalUI()
	usageBytes, archiveBytes, limitBytes :=
		usage.UsageBytes, usage.ArchiveBytes, usage.LimitBytes

	if c.git {
		usageBytes, archiveBytes, limitBytes =
			usage.GitUsageBytes, usage.GitArchiveBytes, usage.GitLimitBytes
	}

	if c.json {
		data := simpleFSQuotaStruct{
			UsageBytes: usageBytes,
			QuotaBytes: limitBytes,
		}
		if c.archived {
			data.ArchivedBytes = archiveBytes
		}
		output, err := json.Marshal(data)
		if err != nil {
			return err
		}
		ui.Printf("%s\n", output)
		return nil
	}

	ui.Printf("Usage:\t\t%s\n", c.humanizeBytes(usageBytes))
	if c.archived {
		ui.Printf("Archived:\t%s\n", c.humanizeBytes(archiveBytes))
	}
	ui.Printf("Quota:\t\t%s\n", c.humanizeBytes(limitBytes))
	return nil
}

// ParseArgv gets the optional -r switch
func (c *CmdSimpleFSQuota) ParseArgv(ctx *cli.Context) error {
	c.git = ctx.Bool("git")
	c.bytes = ctx.Bool("bytes")
	c.archived = ctx.Bool("archived")
	c.json = ctx.Bool("json")

	if len(ctx.String("team")) > 0 {
		teamName, err := keybase1.TeamNameFromString(ctx.String("team"))
		if err != nil {
			return err
		}
		c.teamName = teamName
	}

	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSQuota) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}

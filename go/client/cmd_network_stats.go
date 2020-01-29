package client

import (
	"encoding/json"
	"fmt"
	"strconv"

	humanize "github.com/dustin/go-humanize"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/flexibletable"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

func NewCmdNetworkStats(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "network-stats",
		Usage: "Show instrumentation about network usage",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdNetworkStats{Contextified: libkb.NewContextified(g)}, "status", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output status as JSON",
			},
		},
	}
}

type CmdNetworkStats struct {
	libkb.Contextified
	json bool
}

func (c *CmdNetworkStats) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("network-status")
	}
	c.json = ctx.Bool("json")
	return nil
}

func (c *CmdNetworkStats) load() ([]keybase1.InstrumentationStat, error) {
	cli, err := GetConfigClient(c.G())
	if err != nil {
		return nil, err
	}

	return cli.GetNetworkStats(context.TODO(), 0)
}

func (c *CmdNetworkStats) Run() error {
	stats, err := c.load()
	if err != nil {
		return err
	}
	if c.json {
		b, err := json.MarshalIndent(stats, "", "    ")
		if err != nil {
			return err
		}
		dui := c.G().UI.GetDumbOutputUI()
		_, err = dui.Printf(string(b) + "\n")
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	w, _ := ui.TerminalSize()
	table := &flexibletable.Table{}
	err = table.Insert(flexibletable.Row{
		flexibletable.Cell{
			Alignment: flexibletable.Right,
			Content:   flexibletable.SingleCell{Item: "Tag"},
		},
		flexibletable.Cell{
			Alignment: flexibletable.Left,
			Content:   flexibletable.SingleCell{Item: "Count"},
		},
		flexibletable.Cell{
			Alignment: flexibletable.Left,
			Content:   flexibletable.SingleCell{Item: "Avg"},
		},
		flexibletable.Cell{
			Alignment: flexibletable.Left,
			Content:   flexibletable.SingleCell{Item: "Min"},
		},
		flexibletable.Cell{
			Alignment: flexibletable.Left,
			Content:   flexibletable.SingleCell{Item: "Max"},
		},
		flexibletable.Cell{
			Alignment: flexibletable.Left,
			Content:   flexibletable.SingleCell{Item: "Total"},
		},
		flexibletable.Cell{
			Alignment: flexibletable.Left,
			Content:   flexibletable.SingleCell{Item: "Avg"},
		},
		flexibletable.Cell{
			Alignment: flexibletable.Left,
			Content:   flexibletable.SingleCell{Item: "Min"},
		},
		flexibletable.Cell{
			Alignment: flexibletable.Left,
			Content:   flexibletable.SingleCell{Item: "Max"},
		},
		flexibletable.Cell{
			Alignment: flexibletable.Left,
			Content:   flexibletable.SingleCell{Item: "Total"},
		},
	})
	if err != nil {
		return err
	}
	for _, stat := range stats {
		err := table.Insert(flexibletable.Row{
			flexibletable.Cell{
				Alignment: flexibletable.Right,
				Content:   flexibletable.SingleCell{Item: stat.Tag},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: strconv.Itoa(stat.NumCalls)},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: stat.AvgDur.Duration().String()},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: stat.MinDur.Duration().String()},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: stat.MaxDur.Duration().String()},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: stat.TotalDur.Duration().String()},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: humanize.Bytes(uint64(stat.AvgSize))},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: humanize.Bytes(uint64(stat.MinSize))},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: humanize.Bytes(uint64(stat.MaxSize))},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: humanize.Bytes(uint64(stat.TotalSize))},
			},
		})
		if err != nil {
			return err
		}
	}
	if err := table.Render(ui.OutputWriter(), " ", w, []flexibletable.ColumnConstraint{
		50,
		flexibletable.Expandable,
		flexibletable.Expandable,
		flexibletable.Expandable,
		flexibletable.Expandable,
		flexibletable.Expandable,
		flexibletable.Expandable,
		flexibletable.Expandable,
		flexibletable.Expandable,
		flexibletable.Expandable,
	}); err != nil {
		return fmt.Errorf("rendering stat info list view error: %v\n", err)
	}
	return nil
}

func (c *CmdNetworkStats) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

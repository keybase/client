package client

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
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
		Name:     "network-stats",
		Usage:    "Show instrumentation about network usage",
		Unlisted: true,
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdNetworkStats{Contextified: libkb.NewContextified(g)}, "network-stats", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output status as JSON",
			},
			cli.StringFlag{
				Name:  "src",
				Usage: "Choose the source of records one of 'local', 'remote'",
				Value: "remote",
			},
			cli.StringFlag{
				Name:  "o, order-by",
				Usage: "Order by a column, one of 'calls', 'duration', 'size'",
				Value: "size",
			},
			cli.BoolFlag{
				Name:  "descending",
				Usage: "Sort in descending order",
			},
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Seed data from an input file instead of reading data from the service. Useful for analyzing log send JSON",
			},
		},
	}
}

type CmdNetworkStats struct {
	libkb.Contextified
	networkSrc keybase1.NetworkSource
	json       bool
	descending bool
	orderBy    string
	infile     string
}

func (c *CmdNetworkStats) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("network-status")
	}
	c.json = ctx.Bool("json")
	c.descending = ctx.Bool("descending")
	c.infile = ctx.String("infile")
	c.orderBy = ctx.String("order-by")
	switch c.orderBy {
	case "calls", "duration", "size":
	default:
		return fmt.Errorf("Unexpected order by %q", c.orderBy)
	}
	networkSrc := ctx.String("src")
	switch networkSrc {
	case "local":
		c.networkSrc = keybase1.NetworkSource_LOCAL
	case "remote":
		c.networkSrc = keybase1.NetworkSource_REMOTE
	default:
		if len(networkSrc) > 0 {
			return fmt.Errorf("Unknown source %q, must be 'local' or 'remote'", networkSrc)
		}
		c.networkSrc = keybase1.NetworkSource_REMOTE
	}
	return nil
}

func (c *CmdNetworkStats) load() ([]keybase1.InstrumentationStat, error) {
	cli, err := GetConfigClient(c.G())
	if err != nil {
		return nil, err
	}

	return cli.GetNetworkStats(context.TODO(), keybase1.GetNetworkStatsArg{NetworkSrc: c.networkSrc})
}

func (c *CmdNetworkStats) Run() (err error) {
	var stats []keybase1.InstrumentationStat
	if c.infile != "" {
		b, err := os.ReadFile(c.infile)
		if err != nil {
			return err
		}
		var statsJSON libkb.NetworkStatsJSON
		if err = json.Unmarshal(b, &statsJSON); err != nil {
			return err
		}
		switch c.networkSrc {
		case keybase1.NetworkSource_LOCAL:
			stats = statsJSON.Local
		case keybase1.NetworkSource_REMOTE:
			stats = statsJSON.Remote
		}
	} else {
		stats, err = c.load()
		if err != nil {
			return err
		}
	}
	switch c.orderBy {
	case "calls":
		sort.Slice(stats, func(i, j int) bool {
			x, y := stats[i].NumCalls, stats[j].NumCalls
			if c.descending {
				return x < y
			}
			return x > y
		})
	case "size":
		sort.Slice(stats, func(i, j int) bool {
			x, y := stats[i].TotalSize, stats[j].TotalSize
			if c.descending {
				return x < y
			}
			return x > y
		})
	case "duration":
		sort.Slice(stats, func(i, j int) bool {
			x, y := stats[i].TotalDur, stats[j].TotalDur
			if c.descending {
				return x < y
			}
			return x > y
		})
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
			Content:   flexibletable.SingleCell{Item: "Ctime"},
		},
		flexibletable.Cell{
			Alignment: flexibletable.Left,
			Content:   flexibletable.SingleCell{Item: "Mtime"},
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
				Content:   flexibletable.SingleCell{Item: humanize.Time(stat.Ctime.Time())},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: humanize.Time(stat.Mtime.Time())},
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
		20,
		40,
		40,
		35,
		35,
		35,
		35,
		35,
		35,
		35,
		35,
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

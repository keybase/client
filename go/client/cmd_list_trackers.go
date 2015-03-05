package main

import (
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// CmdListTrackers is the 'list-trackers' command.  It displays
// all the trackers for a user.
type CmdListTrackers struct {
	uid      *libkb.UID
	username string
}

// NewCmdListTrackers creates a new cli.Command.
func NewCmdListTrackers(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "list-trackers",
		Usage:       "keybase list-trackers [username]",
		Description: "List trackers",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "i, uid",
				Usage: "Load user by UID",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdListTrackers{}, "list-trackers", c)
		},
	}
}

// Run runs the command in standalone mode.
func (c *CmdListTrackers) Run() error {
	ctx := &engine.Context{LogUI: G.UI.GetLogUI()}
	var eng *engine.TrackerList
	if c.uid != nil {
		eng = engine.NewTrackerList(c.uid)
	} else if len(c.username) > 0 {
		eng = engine.NewTrackerListUsername(c.username)
	} else {
		return fmt.Errorf("need uid or username")
	}

	if err := engine.RunEngine(eng, ctx, nil, nil); err != nil {
		return err
	}
	c.output(eng.List())

	return nil
}

// RunClient runs the command in client/server mode.
func (c *CmdListTrackers) RunClient() error {
	cli, err := GetUserClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}

	var trs []keybase_1.Tracker
	if c.uid != nil {
		trs, err = cli.TrackerList(keybase_1.TrackerListArg{Uid: c.uid.Export()})
	} else if len(c.username) > 0 {
		trs, err = cli.TrackerListByName(keybase_1.TrackerListByNameArg{Username: c.username})
	}
	if err != nil {
		return err
	}
	c.output(c.convert(trs))

	return nil
}

func (c *CmdListTrackers) convert(a []keybase_1.Tracker) []libkb.Tracker {
	res := make([]libkb.Tracker, len(a))
	for i, v := range a {
		res[i] = libkb.Tracker{
			Tracker: libkb.ImportUID(v.Tracker),
			Status:  v.Status,
			Mtime:   v.Mtime,
		}
	}
	return res
}

// temporary output until usersummary working
func (c *CmdListTrackers) output(trs []libkb.Tracker) {
	if len(trs) == 0 {
		fmt.Printf("no trackers\n")
		return
	}

	noun := "tracker"
	if len(trs) > 1 {
		noun = "trackers"
	}
	fmt.Printf("%d %s:\n\n", len(trs), noun)

	w := new(tabwriter.Writer)
	w.Init(os.Stdout, 5, 0, 3, ' ', 0)
	fmt.Fprintf(w, "Tracker\tStatus\tMtime\n")
	fmt.Fprintf(w, "==========\t==========\t==========\n")
	for _, v := range trs {
		fmt.Fprintf(w, "%s\t%d\t%d\n", v.Tracker, v.Status, v.Status)
	}
	w.Flush()
}

// ParseArgv parses the command args.
func (c *CmdListTrackers) ParseArgv(ctx *cli.Context) error {
	byUID := ctx.Bool("uid")
	if len(ctx.Args()) == 1 {
		if byUID {
			var err error
			c.uid, err = libkb.UidFromHex(ctx.Args()[0])
			if err != nil {
				return err
			}
		} else {
			c.username = ctx.Args()[0]
		}
	}

	if len(c.username) == 0 && c.uid == nil {
		// nothing specified, so use current user
		c.uid = G.GetMyUID()
		if c.uid == nil {
			return libkb.NoUserConfigError{}
		}
	}
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdListTrackers) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:   true,
		API:      true,
		Terminal: true,
	}
}

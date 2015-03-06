package main

import (
	"fmt"
	"os"
	"strings"
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

	trs := eng.List()
	var summaries []*engine.Summary
	for i := 0; i < len(trs); i += libkb.USER_SUMMARY_LIMIT {
		max := i + libkb.USER_SUMMARY_LIMIT
		if max > len(trs) {
			max = len(trs)
		}
		sub := trs[i:max]
		uids := make([]libkb.UID, len(sub))
		for i, v := range sub {
			uids[i] = v.Tracker
		}
		sumeng := engine.NewUserSummary(uids)
		if err := engine.RunEngine(sumeng, ctx, nil, nil); err != nil {
			return err
		}
		summaries = append(summaries, sumeng.SummariesList()...)
	}

	c.output(summaries)

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

	var summaries []keybase_1.UserSummary
	for i := 0; i < len(trs); i += libkb.USER_SUMMARY_LIMIT {
		max := i + libkb.USER_SUMMARY_LIMIT
		if max > len(trs) {
			max = len(trs)
		}
		sub := trs[i:max]
		uids := make([]keybase_1.UID, len(sub))
		for i, v := range sub {
			uids[i] = v.Tracker
		}
		sums, err := cli.LoadUncheckedUserSummaries(uids)
		if err != nil {
			return err
		}
		summaries = append(summaries, sums...)
	}

	c.coutput(summaries)

	return nil
}

func (c *CmdListTrackers) headout(count int) *tabwriter.Writer {
	if count == 0 {
		fmt.Printf("no trackers\n")
		return nil
	}

	noun := "tracker"
	if count > 1 {
		noun = "trackers"
	}
	fmt.Printf("%d %s:\n\n", count, noun)

	w := new(tabwriter.Writer)
	w.Init(os.Stdout, 5, 0, 3, ' ', 0)
	fmt.Fprintf(w, "Username\tFull name\tProofs\n")
	fmt.Fprintf(w, "==========\t==========\t==========\n")
	return w
}

func (c *CmdListTrackers) output(sums []*engine.Summary) {
	w := c.headout(len(sums))
	if w == nil {
		return
	}
	for _, v := range sums {
		p := c.proofSummary(v.Proofs.Export())
		fmt.Fprintf(w, "%s\t%s\t%s\n", v.Username, v.FullName, p)
	}
	w.Flush()
}

func (c *CmdListTrackers) coutput(sums []keybase_1.UserSummary) {
	w := c.headout(len(sums))
	if w == nil {
		return
	}
	for _, v := range sums {
		p := c.proofSummary(v.Proofs)
		fmt.Fprintf(w, "%s\t%s\t%s\n", v.Username, v.FullName, p)
	}
	w.Flush()
}

func (c *CmdListTrackers) proofSummary(p keybase_1.Proofs) string {
	var ps []string
	apnotnil := func(is *string, name string) {
		if is != nil {
			ps = append(ps, name+": "+*is)
		}
	}
	apnotnil(p.Twitter, "twitter")
	apnotnil(p.Github, "github")
	apnotnil(p.Reddit, "reddit")
	apnotnil(p.Hackernews, "hn")
	apnotnil(p.Coinbase, "coinbase")

	for _, wp := range p.Web {
		ps = append(ps, wp.Hostname)
	}

	return strings.Join(ps, ", ")
}

/*
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
*/

func (c *CmdListTrackers) summarize(trs []libkb.Tracker) {
	uids := make([]libkb.UID, len(trs))
	for i, v := range trs {
		uids[i] = v.Tracker
	}
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

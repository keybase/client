package client

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
		Name:        "trackers",
		Usage:       "keybase list trackers [username]",
		Description: "List trackers",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "i, uid",
				Usage: "Load user by UID",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdListTrackers{}, "trackers", c)
		},
	}
}

type batchfn func([]keybase_1.UID) ([]keybase_1.UserSummary, error)

// Run runs the command in standalone mode.
func (c *CmdListTrackers) Run() error {
	ctx := &engine.Context{LogUI: G.UI.GetLogUI()}
	var eng *engine.ListTrackersEngine
	if c.uid != nil {
		eng = engine.NewListTrackers(c.uid)
	} else if len(c.username) > 0 {
		eng = engine.NewListTrackersByName(c.username)
	} else {
		eng = engine.NewListTrackersSelf()
	}

	if err := engine.RunEngine(eng, ctx); err != nil {
		return err
	}
	trs := eng.ExportedList()

	summarize := func(uids []keybase_1.UID) (res []keybase_1.UserSummary, err error) {
		sumeng := engine.NewUserSummary(libkb.ImportUIDs(uids))
		if err = engine.RunEngine(sumeng, ctx); err != nil {
			return
		}
		res = sumeng.ExportedSummariesList()
		return
	}

	c.output(trs, summarize)
	return nil
}

func populateList(trs []keybase_1.Tracker, summarizer batchfn) (ret []keybase_1.UserSummary, err error) {

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
		var tmp []keybase_1.UserSummary
		if tmp, err = summarizer(uids); err != nil {
			return
		}
		ret = append(ret, tmp...)
	}
	return
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
		trs, err = cli.ListTrackers(keybase_1.ListTrackersArg{Uid: c.uid.Export()})
	} else if len(c.username) > 0 {
		trs, err = cli.ListTrackersByName(keybase_1.ListTrackersByNameArg{Username: c.username})
	} else {
		trs, err = cli.ListTrackersSelf(0)
	}
	if err != nil {
		return err
	}

	summarize := func(uids []keybase_1.UID) (res []keybase_1.UserSummary, err error) {
		return cli.LoadUncheckedUserSummaries(uids)
	}

	return c.output(trs, summarize)
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

func (c *CmdListTrackers) output(trs []keybase_1.Tracker, summarizer batchfn) (err error) {
	var sums []keybase_1.UserSummary
	if sums, err = populateList(trs, summarizer); err != nil {
		return err
	}

	w := c.headout(len(sums))
	if w == nil {
		return nil
	}
	for _, v := range sums {
		p := c.proofSummary(v.Proofs)
		fmt.Fprintf(w, "%s\t%s\t%s\n", v.Username, v.FullName, p)
	}
	w.Flush()

	return nil
}

func (c *CmdListTrackers) proofSummary(p keybase_1.Proofs) string {
	var ps []string
	for _, sp := range p.Social {
		ps = append(ps, sp.IdString)
	}
	for _, wp := range p.Web {
		ps = append(ps, wp.Hostname)
	}

	return strings.Join(ps, ", ")
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

	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdListTrackers) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

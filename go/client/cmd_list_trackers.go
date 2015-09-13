package client

import (
	"encoding/json"
	"fmt"
	"strings"
	"text/tabwriter"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// CmdListTrackers is the 'list-trackers' command.  It displays
// all the trackers for a user.
type CmdListTrackers struct {
	uid      keybase1.UID
	username string
	verbose  bool
	json     bool
	headers  bool
}

// NewCmdListTrackers creates a new cli.Command.
func NewCmdListTrackers(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "list-trackers",
		ArgumentHelp: "<username>",
		Usage:        "List trackers",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "i, uid",
				Usage: "Load user by UID.",
			},
			cli.BoolFlag{
				Name:  "v, verbose",
				Usage: "A full dump, with more gory details.",
			},
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output as JSON (default is text).",
			},
			cli.BoolFlag{
				Name:  "H, headers",
				Usage: "Show column headers.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdListTrackers{}, "list-trackers", c)
		},
	}
}

type batchfn func([]keybase1.UID) ([]keybase1.UserSummary, error)

func populateList(trs []keybase1.Tracker, summarizer batchfn) (ret []keybase1.UserSummary, err error) {

	for i := 0; i < len(trs); i += libkb.UserSummaryLimit {
		max := i + libkb.UserSummaryLimit
		if max > len(trs) {
			max = len(trs)
		}
		sub := trs[i:max]
		uids := make([]keybase1.UID, len(sub))
		for i, v := range sub {
			uids[i] = v.Tracker
		}
		var tmp []keybase1.UserSummary
		if tmp, err = summarizer(uids); err != nil {
			return
		}
		ret = append(ret, tmp...)
	}
	return
}

// RunClient runs the command in client/server mode.
func (c *CmdListTrackers) Run() error {
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

	var trs []keybase1.Tracker
	if c.uid.Exists() {
		trs, err = cli.ListTrackers(keybase1.ListTrackersArg{Uid: c.uid})
	} else if len(c.username) > 0 {
		trs, err = cli.ListTrackersByName(keybase1.ListTrackersByNameArg{Username: c.username})
	} else {
		trs, err = cli.ListTrackersSelf(0)
	}
	if err != nil {
		return err
	}

	summarize := func(uids []keybase1.UID) (res []keybase1.UserSummary, err error) {
		return cli.LoadUncheckedUserSummaries(keybase1.LoadUncheckedUserSummariesArg{Uids: uids})
	}

	return c.output(trs, summarize)
}

func (c *CmdListTrackers) headout(count int) *tabwriter.Writer {
	if !c.verbose {
		return nil
	}

	noun := "tracker"
	if count > 1 {
		noun = "trackers"
	}
	GlobUI.Printf("%d %s:\n\n", count, noun)

	w := GlobUI.DefaultTabWriter()
	if c.headers {
		fmt.Fprintf(w, "Username\tFull name\tProofs\n")
		fmt.Fprintf(w, "==========\t==========\t==========\n")
	}
	return w
}

func (c *CmdListTrackers) output(trs []keybase1.Tracker, summarizer batchfn) (err error) {
	var sums []keybase1.UserSummary
	if sums, err = populateList(trs, summarizer); err != nil {
		return err
	}

	if len(sums) == 0 {
		GlobUI.Printf("no trackers\n")
		return nil
	}

	if c.json {
		return c.outputJSON(sums)
	}

	if c.verbose {
		w := c.headout(len(sums))
		if w == nil {
			return nil
		}
		for _, v := range sums {
			p := c.proofSummary(v.Proofs)
			fmt.Fprintf(w, "%s\t%s\t%s\n", v.Username, v.FullName, p)
		}
		w.Flush()
	} else {
		for _, v := range sums {
			GlobUI.Println(v.Username)
		}
	}

	return nil
}

func (c *CmdListTrackers) outputJSON(sums []keybase1.UserSummary) error {
	type smallProofs struct {
		Social     []keybase1.TrackProof `json:"social,omitempty"`
		Web        []keybase1.WebProof   `json:"web,omitempty"`
		PublicKeys []keybase1.PublicKey  `json:"public_keys,omitempty"`
	}
	type smallSum struct {
		UID      keybase1.UID `json:"uid"`
		Username string       `json:"username"`
		FullName string       `json:"full_name,omitempty"`
		Proofs   smallProofs  `json:"proofs,omitempty"`
	}
	small := make([]smallSum, len(sums))
	for i, s := range sums {
		small[i] = smallSum{
			UID:      s.Uid,
			Username: s.Username,
			FullName: s.FullName,
			Proofs: smallProofs{
				Social:     s.Proofs.Social,
				Web:        s.Proofs.Web,
				PublicKeys: s.Proofs.PublicKeys,
			},
		}
	}

	j, err := json.MarshalIndent(small, "", "\t")
	if err != nil {
		return err
	}
	GlobUI.Println(string(j))
	return nil
}

func (c *CmdListTrackers) proofSummary(p keybase1.Proofs) string {
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
			c.uid, err = libkb.UIDFromHex(ctx.Args()[0])
			if err != nil {
				return err
			}
		} else {
			c.username = ctx.Args()[0]
		}
	}

	c.verbose = ctx.Bool("verbose")
	c.json = ctx.Bool("json")
	c.headers = ctx.Bool("headers")

	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdListTrackers) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

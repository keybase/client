package main

import (
	"fmt"
	"io"
	"os"
	"regexp"
	"sort"
	"strings"

	"github.com/codegangsta/cli"
	"github.com/keybase/go-jsonw"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
)

type TrackList []*libkb.TrackChainLink

func (tl TrackList) Len() int {
	return len(tl)
}

func (tl TrackList) Swap(i, j int) {
	tl[i], tl[j] = tl[j], tl[i]
}

func (tl TrackList) Less(i, j int) bool {
	return strings.ToLower(tl[i].ToDisplayString()) < strings.ToLower(tl[j].ToDisplayString())
}

type CmdListTracking struct {
	filter  string
	json    bool
	verbose bool
	headers bool
	user    *libkb.User
	tracks  TrackList
}

func (s *CmdListTracking) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.json = ctx.Bool("json")
	s.verbose = ctx.Bool("verbose")
	s.headers = ctx.Bool("headers")
	s.filter = ctx.String("filter")

	if nargs > 0 {
		err = fmt.Errorf("list-tracking takes no args")
	}

	return err
}

func (s *CmdListTracking) filterTracks(f func(libkb.TrackChainLink) bool) {
	tracks := make([]*libkb.TrackChainLink, 0, 0)
	for _, link := range s.tracks {
		if f(*link) {
			tracks = append(tracks, link)
		}
	}
	s.tracks = tracks
}

func (s *CmdListTracking) FilterRxx() error {
	if len(s.filter) == 0 {
		return nil
	}
	rxx, err := regexp.Compile(s.filter)
	if err != nil {
		return err
	}
	s.filterTracks(func(l libkb.TrackChainLink) bool {
		if rxx.MatchString(l.ToDisplayString()) {
			return true
		}
		for _, sb := range l.ToServiceBlocks() {
			_, v := sb.ToKeyValuePair()
			if rxx.MatchString(v) {
				return true
			}
		}
		return false
	})
	return nil
}

func (s *CmdListTracking) ProcessTracks() (err error) {
	if err = s.FilterRxx(); err != nil {
		return
	}
	return
}

func (s *CmdListTracking) skipLink(link libkb.TypedChainLink) bool {
	return link.IsRevoked() || link.IsRevocationIsh() || !s.IsActiveKey(link)
}

func (s *CmdListTracking) IsActiveKey(link libkb.TypedChainLink) bool {
	return link.IsInCurrentFamily(s.user)
}

func (s *CmdListTracking) CondenseRecord(l *libkb.TrackChainLink) (out *jsonw.Wrapper, err error) {
	var uid *libkb.UID
	var fp *libkb.PgpFingerprint
	var un string
	out = jsonw.NewDictionary()
	rp := l.RemoteKeyProofs()

	if uid, err = l.GetTrackedUid(); err != nil {
		return
	}

	if fp, err = l.GetTrackedPgpFingerprint(); err != nil {
		return
	}

	if un, err = l.GetTrackedUsername(); err != nil {
		return
	}

	out.SetKey("uid", jsonw.NewString(uid.String()))
	out.SetKey("key", jsonw.NewString(strings.ToUpper(fp.String())))
	out.SetKey("ctime", jsonw.NewInt64(l.GetCTime().Unix()))
	out.SetKey("username", jsonw.NewString(un))
	out.SetKey("proofs", rp)

	return
}

func (s *CmdListTracking) DisplayTable() (err error) {

	var cols []string

	if s.headers && s.verbose {
		cols = []string{
			"Username",
			"Sig ID",
			"PGP fingerprint",
			"When Tracked",
			"Proofs",
		}
	}

	i := 0
	idtab := s.tracks

	rowfunc := func() []string {
		var row []string

		for ; i < len(idtab) && row == nil; i++ {
			link := idtab[i]

			if s.skipLink(link) {
				continue
			}

			if !s.verbose {
				row = []string{link.ToDisplayString()}
				continue
			}

			fp, err := link.GetTrackedPgpFingerprint()
			if err != nil {
				G.Log.Warning("Bad track of %s: %s", link.ToDisplayString(), err.Error())
				continue
			}

			row = []string{
				link.ToDisplayString(),
				link.GetSigId().ToDisplayString(true),
				strings.ToUpper(fp.String()),
				libkb.FormatTime(link.GetCTime()),
			}
			for _, sb := range link.ToServiceBlocks() {
				row = append(row, sb.ToIdString())
			}
		}
		return row
	}

	libkb.Tablify(os.Stdout, cols, rowfunc)

	return
}

func (s *CmdListTracking) DisplayJSON() (err error) {
	tmp := make([]*jsonw.Wrapper, 0, 1)
	for _, e := range s.tracks {
		var rec *jsonw.Wrapper
		var e2 error
		if s.verbose {
			rec = e.GetPayloadJson()
		} else if rec, e2 = s.CondenseRecord(e); e2 != nil {
			G.Log.Warning("In conversion to JSON: %s", e2.Error())
		}
		if e2 == nil {
			tmp = append(tmp, rec)
		}
	}

	ret := jsonw.NewArray(len(tmp))
	for i, r := range tmp {
		ret.SetIndex(i, r)
	}

	_, err = io.WriteString(os.Stdout, ret.MarshalPretty()+"\n")
	return
}

func (s *CmdListTracking) Display() (err error) {
	if s.json {
		err = s.DisplayJson()
	} else {
		err = s.DisplayTable()
	}
	return
}

func (s *CmdListTracking) RunClient() error { return s.Run() }

func (s *CmdListTracking) Run() (err error) {

	arg := libkb.LoadUserArg{Self: true}
	s.user, err = libkb.LoadUser(arg)

	if err != nil {
		return
	}

	s.tracks = s.user.IdTable.GetTrackList()

	if err = s.ProcessTracks(); err != nil {
		return
	}

	sort.Sort(s.tracks)

	if err = s.Display(); err != nil {
		return
	}

	return
}

func NewCmdListTracking(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "list-tracking",
		Usage:       "keybase list-tracking",
		Description: "list who you're tracking",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdListTracking{}, "list-tracking", c)
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

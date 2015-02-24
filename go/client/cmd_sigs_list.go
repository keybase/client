package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-jsonw"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"io"
	"os"
	"regexp"
	"strings"
)

type CmdSigsList struct {
	filter  string
	revoked bool
	json    bool
	verbose bool
	allKeys bool
	headers bool
	types   map[string]bool

	username string

	user *libkb.User
	sigs []libkb.TypedChainLink
}

func (s *CmdSigsList) ParseTypes(ctx *cli.Context) error {
	tmp := ctx.String("type")
	if len(tmp) == 0 {
		return nil
	}

	types := map[string]bool{
		"track":          true,
		"proof":          true,
		"cryptocurrency": true,
		"self":           true,
	}

	ret := make(map[string]bool)
	v := strings.Split(tmp, ",")
	for _, i := range v {
		ok, found := types[i]
		if !ok || !found {
			return fmt.Errorf("unknown signature type: %s", i)
		} else {
			ret[i] = true
		}
	}
	s.types = ret
	return nil
}

func (s *CmdSigsList) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.revoked = ctx.Bool("revoked")
	s.json = ctx.Bool("json")
	s.verbose = ctx.Bool("verbose")
	s.allKeys = ctx.Bool("all-keys")
	s.headers = ctx.Bool("headers")
	s.filter = ctx.String("filter")

	if err = s.ParseTypes(ctx); err != nil {
		return err
	}

	if nargs == 1 {
		s.username = ctx.Args()[0]
	} else if nargs > 1 {
		err = fmt.Errorf("list takes at most 1 arg, a username")
	}

	return err
}

func (s *CmdSigsList) filterSigs(f func(libkb.TypedChainLink) bool) {
	sigs := make([]libkb.TypedChainLink, 0, 0)
	for _, link := range s.sigs {
		if f(link) {
			sigs = append(sigs, link)
		}
	}
	s.sigs = sigs
}

func (s *CmdSigsList) SelectSigs() error {
	if s.types != nil {
		s.filterSigs(func(l libkb.TypedChainLink) bool {
			ok, found := s.types[l.Type()]
			return ok && found
		})
	}
	return nil
}

func (s *CmdSigsList) FilterRxx() error {
	if len(s.filter) == 0 {
		return nil
	}
	rxx, err := regexp.Compile(s.filter)
	if err != nil {
		return err
	}
	s.filterSigs(func(l libkb.TypedChainLink) bool {
		return rxx.MatchString(l.ToDisplayString())
	})
	return nil
}

func (s *CmdSigsList) ProcessSigs() (err error) {
	if err = s.SelectSigs(); err != nil {
		return
	}
	if err = s.FilterRxx(); err != nil {
		return
	}
	return
}

func (s *CmdSigsList) skipLink(link libkb.TypedChainLink) bool {
	return ((!s.revoked && (link.IsRevoked() || link.IsRevocationIsh())) ||
		(!s.allKeys && !s.IsActiveKey(link)))
}

func (s *CmdSigsList) IsActiveKey(link libkb.TypedChainLink) bool {
	return link.IsInCurrentFamily(s.user)
}

func (s *CmdSigsList) DisplayTable() (err error) {

	var cols []string

	if s.headers {
		cols = []string{
			"#",
			"SigId",
			"Type",
			"Date",
		}
		if s.revoked {
			cols = append(cols, "Revoked")
		}
		if s.allKeys {
			cols = append(cols, "Active", "Key")
		}
		cols = append(cols, "Body")
	}

	i := 0
	idtab := s.sigs

	rowfunc := func() []string {
		var row []string
		for ; i < len(idtab) && row == nil; i++ {
			link := idtab[i]

			if s.skipLink(link) {
				continue
			}

			row = []string{
				fmt.Sprintf("%d", int(link.GetSeqno())),
				link.GetSigId().ToDisplayString(s.verbose),
				link.Type(),
				libkb.FormatTime(link.GetCTime()),
			}
			if s.revoked {
				var ch string
				if link.IsRevoked() {
					ch = "R"
				} else {
					ch = "."
				}
				row = append(row, ch)
			}
			if s.allKeys {
				var ch string
				if s.IsActiveKey(link) {
					ch = "+"
				} else {
					ch = "-"
				}
				key := link.GetPgpFingerprint().ToDisplayString(s.verbose)
				row = append(row, ch, key)
			}
			row = append(row, link.ToDisplayString())
		}
		return row
	}

	libkb.Tablify(os.Stdout, cols, rowfunc)

	return
}

func (s *CmdSigsList) DisplayJson() (err error) {
	tmp := make([]*jsonw.Wrapper, 0, len(s.sigs))
	for _, link := range s.sigs {
		if s.skipLink(link) {
			continue
		}
		obj := jsonw.NewDictionary()
		obj.SetKey("seqno", jsonw.NewInt(int(link.GetSeqno())))
		obj.SetKey("sig_id", jsonw.NewString(link.GetSigId().ToDisplayString(true)))
		obj.SetKey("type", jsonw.NewString(link.Type()))
		obj.SetKey("ctime", jsonw.NewInt64(link.GetCTime().Unix()))
		if s.revoked {
			obj.SetKey("revoked", jsonw.NewBool(link.IsRevoked()))
		}
		if s.allKeys {
			obj.SetKey("key_fingerprint", jsonw.NewString(link.GetPgpFingerprint().ToDisplayString(true)))
		}
		obj.SetKey("statement", jsonw.NewString(link.ToDisplayString()))
		tmp = append(tmp, obj)
	}
	ret := jsonw.NewArray(len(tmp))
	for i, obj := range tmp {
		ret.SetIndex(i, obj)
	}
	_, err = io.WriteString(os.Stdout, ret.MarshalPretty()+"\n")
	return
}

func (s *CmdSigsList) Display() (err error) {
	if s.json {
		err = s.DisplayJson()
	} else {
		err = s.DisplayTable()
	}
	return
}

func (s *CmdSigsList) RunClient() error { return s.Run() }

func (s *CmdSigsList) Run() (err error) {

	// XXX maybe do some sort of debug dump with the user that
	// we loaded from the server (or storage).

	arg := libkb.LoadUserArg{AllKeys: s.allKeys}
	if len(s.username) != 0 {
		arg.Name = s.username
	} else {
		arg.Self = true
	}

	s.user, err = libkb.LoadUser(arg)

	if err != nil {
		return
	}

	s.sigs = s.user.IdTable.Order

	if err = s.ProcessSigs(); err != nil {
		return
	}

	if err = s.Display(); err != nil {
		return
	}

	return
}

func NewCmdSigsList(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "list",
		Usage: "keybase sigs list [filter]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSigsList{}, "list", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "r, revoked",
				Usage: "Show revoked signatures",
			},
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "output in json format; default is text",
			},
			cli.BoolFlag{
				Name:  "v, verbose",
				Usage: "a full dump, with more gory detail",
			},
			cli.StringFlag{
				Name: "t, type",
				Usage: "type of sig to output; choose from {track" +
					", proof, cryptocurrency, self}; all by default",
			},
			cli.BoolFlag{
				Name:  "a, all-keys",
				Usage: "show signatures from all (replaced) keys",
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

func NewCmdSigs(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "sigs",
		Usage:       "keybase sigs [subcommands...]",
		Description: "List, revoke signatures",
		Subcommands: []cli.Command{
			NewCmdSigsList(cl),
		},
	}
}

func (v *CmdSigsList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

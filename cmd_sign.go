package libkb

import (
	"fmt"
	"github.com/codegangsta/cli"
	"io"
)

func AddCmdSign(cmd *Command, p *PosixCommandLine, app *cli.App) {
	app.Commands = append(app.Commands, cli.Command{
		Name:        "sign",
		Usage:       "keybase sign [-a] [-o <outfile>] [<infile>]",
		Description: "sign a clear document",
		Action: func(c *cli.Context) {
			*cmd = p.InitSubcommand(c, &CmdSign{}, "sign")
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "b, binary",
				Usage: "output binary message (armored by default",
			},
			cli.StringFlag{
				Name:  "m, message",
				Usage: "provide the message to sign on the command line",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "specify an outfile (stdout by default",
			},
		},
	})
}

type CmdSign struct {
	UnixFilter
	binary bool
	msg    string
}

func (s *CmdSign) Initialize(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.binary = ctx.Bool("binary")
	msg := ctx.String("message")
	outfile := ctx.String("outfile")
	var infile string

	if nargs == 1 {
		infile = ctx.Args()[0]
	} else if nargs > 1 {
		err = fmt.Errorf("sign takes at most 1 arg, an infile")
	}

	err = s.FilterInit(msg, infile, outfile)

	return err
}

func (s *CmdSign) Run() (err error) {
	var key *PgpKeyBundle
	var dumpTo io.WriteCloser
	var written int64

	if err = s.FilterOpen(); err != nil {
		return
	}

	defer func() {
		if dumpTo != nil {
			dumpTo.Close()
		}
		s.Close(err)
	}()

	key, err = G.Keyrings.GetSecretKey("command-line signature")
	if err != nil {
		return
	} else if key == nil {
		err = fmt.Errorf("No secret key available")
		return
	}

	dumpTo, err = AttachedSignWrapper(s.sink, *key, !s.binary)
	if err != nil {
		return
	}

	written, err = io.Copy(dumpTo, s.source)
	if err == nil && written == 0 {
		err = fmt.Errorf("Empty source file, nothing to sign")
	}

	return
}

func (v *CmdSign) UseConfig() bool   { return true }
func (v *CmdSign) UseKeyring() bool  { return true }
func (v *CmdSign) UseAPI() bool      { return true }
func (v *CmdSign) UseTerminal() bool { return true }

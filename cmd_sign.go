package libkb

import (
	"fmt"
	"github.com/codegangsta/cli"
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
	if err := s.FilterOpen(); err != nil {
		return err
	}

	fmt.Printf("signing %v\n", s)
	return
}

func (v *CmdSign) UseConfig() bool   { return true }
func (v *CmdSign) UseKeyring() bool  { return true }
func (v *CmdSign) UseAPI() bool      { return true }
func (v *CmdSign) UseTerminal() bool { return true }

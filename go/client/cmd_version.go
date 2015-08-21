package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdVersion struct {
	devel   bool
	verbose bool
}

func (v *CmdVersion) Run() error {
	if v.verbose {
		libkb.VersionMessage(v.devel, func(s string) { GlobUI.Println(s) })
	} else {
		GlobUI.Println(libkb.VersionString(v.devel))
	}
	return nil
}

func NewCmdVersion(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "version",
		Usage: "print out version information",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "v, verbose",
				Usage: "show extra info",
			},
			cli.BoolFlag{
				Name:  "d, devel",
				Usage: "show build info (for development releases)",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdVersion{}, "version", c)
		},
	}
}

func (v *CmdVersion) ParseArgv(ctx *cli.Context) error {
	v.verbose = ctx.Bool("verbose")
	v.devel = ctx.Bool("devel")
	return nil
}

func (v *CmdVersion) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
	}
}

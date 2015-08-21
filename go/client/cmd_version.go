package client

import (
	"fmt"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdVersion struct {
	verbose bool
}

func (v *CmdVersion) Run() error {
	if v.verbose {
		libkb.VersionMessage(func(s string) { GlobUI.Println(s) })
	} else {
		// Print out semantic version, readable by scripts
		GlobUI.Println(fmt.Sprintf("%s-%s", libkb.Version, libkb.Build))
	}
	return nil
}

func NewCmdVersion(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "version",
		Usage: "print out version information",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "verbose",
				Usage: "show extra info",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdVersion{}, "version", c)
		},
	}
}

func (v *CmdVersion) ParseArgv(ctx *cli.Context) error {
	v.verbose = ctx.Bool("verbose")
	return nil
}

func (v *CmdVersion) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
	}
}

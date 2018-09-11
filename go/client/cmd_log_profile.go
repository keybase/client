// +build !production

package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// This is a devel-only cmd which can be used to see how long different
// g.CTraceTimed calls are taking.
func NewCmdLogProfile(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "profile",
		Usage: "Analyze timed traces from logs.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdLogProfile{Contextified: libkb.NewContextified(g)}, "profile", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "p, path",
				Usage: "Path of logfile to process.",
			},
		},
	}
}

type CmdLogProfile struct {
	libkb.Contextified
	path string
}

func (c *CmdLogProfile) Run() error {
	logProfileContext := libkb.LogProfileContext{
		Contextified: libkb.NewContextified(c.G()),
		Path:         c.path,
	}

	profileData, err := logProfileContext.LogProfile(c.path)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	for _, profStr := range profileData {
		ui.Printf("%v\n", profStr)
	}

	return nil
}

func (c *CmdLogProfile) ParseArgv(ctx *cli.Context) error {
	c.path = ctx.String("path")
	if len(c.path) == 0 {
		return errors.New("path must be set")
	}

	return nil
}

func (c *CmdLogProfile) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

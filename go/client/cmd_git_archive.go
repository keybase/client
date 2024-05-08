package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// CmdGitArchive is the 'git archive' command.
type CmdGitArchive struct {
	libkb.Contextified
}

// newCmdGitArchive creates a new cli.Command.
func newCmdGitArchive(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "archive",
		Usage: "view instructions on archiving git repos",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdGitArchive{
				Contextified: libkb.NewContextified(g)}, "archive", c)
			cl.SetNoStandalone()
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdGitArchive) Run() error {
	ui := c.G().UI.GetTerminalUI()
	ui.Printf("Please use `keybase fs archive` command with the --git flag.\n")
	return nil
}

// ParseArgv parses the arguments.
func (c *CmdGitArchive) ParseArgv(ctx *cli.Context) error {
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdGitArchive) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}

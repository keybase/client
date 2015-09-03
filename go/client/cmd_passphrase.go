package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
)

func NewCmdPassphrase(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "passphrase",
		Usage:       "keybase passphrase [...]",
		Description: "Change or recover your keybase passphrase.",
		Subcommands: []cli.Command{
			NewCmdPassphraseChange(cl),
			NewCmdPassphraseRecover(cl),
		},
	}
}

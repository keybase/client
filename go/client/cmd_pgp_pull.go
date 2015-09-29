package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type CmdPGPPull struct {
	userAsserts []string
}

func (v *CmdPGPPull) ParseArgv(ctx *cli.Context) error {
	v.userAsserts = ctx.Args()
	return nil
}

func (v *CmdPGPPull) Run() (err error) {
	cli, err := GetPGPClient()
	if err != nil {
		return err
	}

	if err = RegisterProtocols(nil); err != nil {
		return err
	}

	return cli.PGPPull(keybase1.PGPPullArg{
		UserAsserts: v.userAsserts,
	})
}

func NewCmdPGPPull(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "pull",
		ArgumentHelp: "[<usernames...>]",
		Usage:        "Download the latest PGP keys for people you track.",
		Flags:        []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPPull{}, "pull", c)
		},
		Description: `"keybase pgp pull" pulls down all of the PGP keys for the people
   you track. On success, it imports those keys into your local GnuPG keychain.
   For existing keys, this means the local GnuPG keyring will get an updated,
   merged copy, via GnuGP's default key merging strategy. For new keys, it
   will be a plain import.

   If usernames (or user assertions) are supplied, only those tracked users
   are pulled. Without arguments, all tracked users are pulled.`,
	}
}

func (v *CmdPGPPull) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}

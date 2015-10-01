package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdPGPUpdate struct {
	fingerprints []string
	all          bool
}

func (v *CmdPGPUpdate) ParseArgv(ctx *cli.Context) error {
	v.fingerprints = ctx.Args()
	v.all = ctx.Bool("all")
	return nil
}

func (v *CmdPGPUpdate) Run() (err error) {
	cli, err := GetPGPClient()
	if err != nil {
		return err
	}

	protocols := []rpc2.Protocol{
		NewSecretUIProtocol(),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.PGPUpdate(keybase1.PGPUpdateArg{
		Fingerprints: v.fingerprints,
		All:          v.all,
	})
}

func NewCmdPGPUpdate(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "update",
		ArgumentHelp: "[fingerprints...]",
		Usage:        "Update your public PGP keys on keybase with those exported from the local GPG keyring",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "all",
				Usage: "Update all available keys.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPUpdate{}, "update", c)
		},
		Description: `'keybase pgp update' pushed updated PGP public keys to the server.
   Public PGP keys are exported from your local GPG keyring and sent
   to the Keybase server, where they will supersede PGP keys that have been
   previously updated. This feature is for updating PGP subkeys, identities,
   and signatures, but cannot be used to change PGP primary keys.

   Only keys with the specified PGP fingerprints will be updated, unless the
   '--all' flag is specified, in which case all PGP keys will be updated.`,
	}
}

func (v *CmdPGPUpdate) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdPGPSelect struct {
	query      string
	multi      bool
	skipImport bool
	onlyImport bool
}

func (v *CmdPGPSelect) ParseArgv(ctx *cli.Context) (err error) {
	if nargs := len(ctx.Args()); nargs == 1 {
		v.query = ctx.Args()[0]
	} else if nargs != 0 {
		err = fmt.Errorf("pgp select takes 0 or 1 arguments")
	}
	if err == nil {
		v.multi = ctx.Bool("multi")
		v.skipImport = ctx.Bool("no-import")
		v.onlyImport = ctx.Bool("only-import")
		if v.onlyImport && v.skipImport {
			err = fmt.Errorf("Can specify only one of --no-import OR --only-import")
		}
	}
	return err
}

func (v *CmdPGPSelect) Run() error {
	c, err := GetPGPClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewGPGUIProtocol(),
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	err = c.PGPSelect(keybase1.PGPSelectArg{
		FingerprintQuery: v.query,
		AllowMulti:       v.multi,
		SkipImport:       v.skipImport,
		OnlyImport:       v.onlyImport,
	})
	err = AddPGPMultiInstructions(err)
	return err
}

func NewCmdPGPSelect(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "select",
		Usage:       "keybase pgp select [<key-query>]",
		Description: "Select a key as your own and register the public half with the server",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPSelect{}, "select", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "multi",
				Usage: "Allow multiple PGP keys",
			},
			cli.BoolFlag{
				Name:  "no-import",
				Usage: "Don't import private key to local Keybase's private keychain",
			},
			cli.BoolFlag{
				Name:  "only-import",
				Usage: "only import the secret key into local Keybase private keycahin",
			},
		},
	}
}

func (v *CmdPGPSelect) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}

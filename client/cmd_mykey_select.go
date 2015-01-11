package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
	"os"
	"strings"
)

type CmdMykeySelect struct {
	state MyKeyState
	query string
}

func (v *CmdMykeySelect) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if err = v.state.ParseArgv(ctx); err != nil {
	} else if nargs == 1 {
		v.query = ctx.Args()[0]
	} else if nargs != 0 {
		err = fmt.Errorf("mkey select takes 0 or 1 arguments")
	}
	return err
}

func (v *CmdMykeySelect) RunClient() error { return v.Run() }
func (v *CmdMykeySelect) Run() (err error) {

	gen := libkb.NewKeyGen(&v.state.arg)

	if err = gen.LoginAndCheckKey(); err != nil {
		return
	}
	if err = v.GetKey(); err != nil {
		return
	}
	if err = v.state.PromptSecretPush(false); err != nil {
		return
	}
	if _, err = gen.Run(); err != nil {
		return
	}
	return
}
func (v *CmdMykeySelect) GetKey() error {

	gpg := G.GetGpgClient()
	if _, err := gpg.Configure(); err != nil {
		return err
	}
	index, err, warns := gpg.Index(true, v.query)
	if err != nil {
		return err
	}
	warns.Warn()
	var keyInfo *libkb.GpgPrimaryKey
	if len(index.Keys) > 1 {
		if len(v.query) > 0 {
			G_UI.Output("Multiple keys matched '" + v.query + "':\n")
		} else {
			G_UI.Output("Multiple keys found:\n")
		}
		headings := []string{
			"#",
			"Algo",
			"Key Id",
			"Expires",
			"Email",
		}
		libkb.Tablify(os.Stdout, headings, index.GetRowFunc())
		p := "Select a key"
		var i int
		if i, err = G_UI.PromptSelection(p, 1, len(index.Keys)+1); err != nil {
			return err
		}
		keyInfo = index.Keys[i-1]
		G.Log.Info("Selected: %s", strings.Join(keyInfo.ToRow(i), " "))
	} else {
		keyInfo = index.Keys[0]
		G.Log.Info("Key selection is unambiguous: %s", keyInfo.GetFingerprint().ToQuads())
	}
	var key *libkb.PgpKeyBundle
	if key, err = gpg.ImportKey(true, *keyInfo.GetFingerprint()); err != nil {
		return err
	}
	if err = key.Unlock("Import of key into keybase keyring"); err != nil {
		return err
	}

	if err == nil {
		v.state.arg.Pregen = key
	}
	return err
}

func NewCmdMykeySelect(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "select",
		Usage:       "keybase mykey select [<key-query>]",
		Description: "Select a key as your own and push it to the server",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdMykeySelect{}, "select", c)
		},
		Flags: mykeyFlags(),
	}
}

func (v *CmdMykeySelect) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
		Terminal:  true,
	}
}

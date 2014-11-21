package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
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

func NewCmdMykeySelect(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:        "select",
		Usage:       "keybase mykey select [<key-query>]",
		Description: "Select a key as your own and push it to the server",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdMykeySelect{}, "select", c)
		},
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

var example string = `
Multiple keys were found that matched 'themax':
 (1)   4096R  6052B2AD31A6631C  exp: 2024-2-3   themax@gmail.com          max@keybase.io        max@maxk.org  krohn@mit.edu  krohn@post.harvard.edu  krohn@alum.mit.edu
 (2)   4096R  081C5490F9F7B7AB  exp: never      max891@keybase.io         themax+891@gmail.com
 (3)   1024D  2D7BA4DBE9378FD9  exp: 2024-3-11  max85@keybase.io          themax+85@gmail.com
 (4)   4096R  63847B4B83930F0C  exp: 2017-10-4  themax@gmail.com          themax@gmail.com
 (5)   2048R  B4C0C0B6EF6BA2A3  exp: never      themax+3219@gmail.com
 (6)   1024D  2FC3671F312AA0FD  exp: never      themax+942@gmail.com
 (7)   2048R  D707EE8287B62514  exp: 2024-3-31  themax+309@gmail.com
 (8)   2048R  F77B98E4D4D80001  exp: 2024-3-28  themax+105.2@gmail.com
 (9)   2048R  BC07EE4BF5A71E11  exp: 2024-3-28  themax+test105@gmail.com
 (10)  2048R  A049F8D7E155170C  exp: 2024-3-24  themax+47@gmail.com
 (11)  1600R  D1DF491E66300928  exp: 2024-3-10  themax+91@gmail.com
 (12)  1024R  36B8DA42022CDC30  exp: 2024-3-10  themax+81@gmail.com
 (13)  2048R  2EE0695E30C55BEF  exp: 2024-2-17  themax+1@gmail.com
`

package main

import (
	"fmt"

	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type MyKeyState struct {
	arg         libkb.KeyGenArg
	interactive bool
}

var SMALL_KEY int = 1024

func (a *MyKeyState) ParseArgv(ctx *cli.Context) (err error) {
	a.arg.DoSecretPush = ctx.Bool("push-secret")
	a.arg.NoPublicPush = ctx.Bool("skip-push") && !a.arg.DoSecretPush
	a.arg.NoPassphrase = ctx.Bool("no-passphrase")
	a.arg.KbPassphrase = ctx.Bool("keybase-passphrase")
	if ctx.Bool("skip-nacl") {
		a.arg.NoNaclEddsa = true
		a.arg.NoNaclDh = true
	}
	if ctx.Bool("debug") {
		a.arg.PrimaryBits = SMALL_KEY
		a.arg.SubkeyBits = SMALL_KEY
	}
	batch := ctx.Bool("batch")
	a.interactive = (!a.arg.NoPublicPush && !a.arg.NoPassphrase && !batch)

	if a.arg.NoPassphrase && a.arg.DoSecretPush {
		err = fmt.Errorf("Passphrase required for pushing secret key to server")
	}

	return err
}

type KeygenUIServer struct {
	ui libkb.KeyGenUI
}

func NewKeyGenUIProtocol() rpc2.Protocol {
	return keybase_1.MykeyUiProtocol(&KeygenUIServer{G_UI.GetKeyGenUI()})
}

func (s *KeygenUIServer) GetPushPreferences(sessionID int) (ret keybase_1.PushPreferences, err error) {
	return s.ui.GetPushPreferences()
}

func mykeyFlags() []cli.Flag {
	return []cli.Flag{
		cli.BoolFlag{
			Name:  "skip-nacl",
			Usage: "skip generation of NaCl keys",
		},
	}
}

func NewCmdMykey(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "mykey",
		Usage:       "keybase mykey [subcommands...]",
		Description: "Manipulate your primary Keybase key",
		Subcommands: []cli.Command{
			NewCmdMykeyGen(cl),
			NewCmdMykeyDelete(cl),
			NewCmdMykeySelect(cl),
			NewCmdMykeyShow(cl),
		},
	}
}

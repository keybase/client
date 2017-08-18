// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/pinentry"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"io"
)

type SecretEntry struct {
	libkb.Contextified
	pinentry *pinentry.Pinentry
	terminal *Terminal
	initRes  *error
	tty      string
}

func NewSecretEntry(g *libkb.GlobalContext, t *Terminal, tty string) *SecretEntry {
	return &SecretEntry{
		Contextified: libkb.NewContextified(g),
		terminal:     t,
		tty:          tty,
	}
}

func (se *SecretEntry) Init() (err error) {

	se.G().Log.Debug("+ SecretEntry.Init()")

	if se.initRes != nil {
		se.G().Log.Debug("- SecretEntry.Init() -> cached %s", libkb.ErrToOk(*se.initRes))
		return *se.initRes
	}

	if se.G().Env.GetNoPinentry() {
		se.G().Log.Debug("| Pinentry skipped due to config")
	} else {
		pe := pinentry.New(se.G().Env.GetPinentry(), se.G().Log, se.tty)
		if e2, fatalerr := pe.Init(); fatalerr != nil {
			err = fatalerr
		} else if e2 != nil {
			se.G().Log.Debug("| Pinentry initialization failed: %s", e2)
		} else {
			se.pinentry = pe
			se.G().Log.Debug("| Pinentry initialized")
		}
	}

	if err == nil {
		if se.pinentry == nil && se.terminal == nil {
			err = fmt.Errorf("No terminal and pinentry init; cannot input secrets")
		}
	}

	se.initRes = &err

	se.G().Log.Debug("- SecretEntry.Init() -> %s", libkb.ErrToOk(err))
	return err
}

func (se *SecretEntry) Get(arg keybase1.SecretEntryArg, termArg *keybase1.SecretEntryArg, w io.Writer) (res *keybase1.SecretEntryRes, err error) {

	if err = se.Init(); err != nil {
		return
	}

	if pe := se.pinentry; pe != nil {
		if len(arg.Reason) > 0 {
			fmt.Fprintf(w, "Collecting your passphrase for %s.\n", arg.Reason)
		}
		res, err = pe.Get(arg)
	} else if se.terminal == nil {
		err = NoTerminalError{}
	} else {
		if termArg == nil {
			termArg = &arg
		}
		res, err = se.terminal.GetSecret(termArg)
	}

	return
}

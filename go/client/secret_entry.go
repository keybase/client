package client

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type SecretEntry struct {
	pinentry *libkb.Pinentry
	terminal *Terminal
	initRes  *error
}

func NewSecretEntry(t *Terminal) *SecretEntry {
	return &SecretEntry{terminal: t}
}

func (se *SecretEntry) Init() (err error) {

	G.Log.Debug("+ SecretEntry.Init()")

	if se.initRes != nil {
		G.Log.Debug("- SecretEntry.Init() -> cached %s", libkb.ErrToOk(*se.initRes))
		return *se.initRes
	}

	if G.Env.GetNoPinentry() {
		G.Log.Debug("| Pinentry skipped due to config")
	} else {
		pe := libkb.NewPinentry()
		if e2, fatalerr := pe.Init(); fatalerr != nil {
			err = fatalerr
		} else if e2 != nil {
			G.Log.Debug("| Pinentry initialization failed: %s", e2.Error())
		} else {
			se.pinentry = pe
			G.Log.Debug("| Pinentry initialized")
		}
	}

	if err != nil {
		// We can't proceed if we hit a fatal error above
	} else if se.pinentry == nil && se.terminal == nil {
		err = fmt.Errorf("No terminal and pinentry init; cannot input secrets")
	}

	se.initRes = &err

	G.Log.Debug("- SecretEntry.Init() -> %s", libkb.ErrToOk(err))
	return err
}

func (se *SecretEntry) Get(arg keybase1.SecretEntryArg, termArg *keybase1.SecretEntryArg) (
	res *keybase1.SecretEntryRes, err error) {

	if err = se.Init(); err != nil {
		return
	}

	if pe := se.pinentry; pe != nil {
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

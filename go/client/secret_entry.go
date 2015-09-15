package client

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/pinentry"
	keybase1 "github.com/keybase/client/protocol/go"
)

type SecretEntry struct {
	pinentry *pinentry.Pinentry
	terminal *Terminal
	initRes  *error
}

type Printer interface {
	Printf(format string, a ...interface{}) (n int, err error)
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
		pe := pinentry.New(G.Env.GetPinentry(), G.Log)
		if e2, fatalerr := pe.Init(); fatalerr != nil {
			err = fatalerr
		} else if e2 != nil {
			G.Log.Debug("| Pinentry initialization failed: %s", e2)
		} else {
			se.pinentry = pe
			G.Log.Debug("| Pinentry initialized")
		}
	}

	if err == nil {
		if se.pinentry == nil && se.terminal == nil {
			err = fmt.Errorf("No terminal and pinentry init; cannot input secrets")
		}
	}

	se.initRes = &err

	G.Log.Debug("- SecretEntry.Init() -> %s", libkb.ErrToOk(err))
	return err
}

func (se *SecretEntry) Get(arg keybase1.SecretEntryArg, termArg *keybase1.SecretEntryArg, printer Printer) (res *keybase1.SecretEntryRes, err error) {

	if err = se.Init(); err != nil {
		return
	}

	if pe := se.pinentry; pe != nil {
		if len(arg.Reason) > 0 {
			printer.Printf("Collecting your passphrase for %s.\n", arg.Reason)
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

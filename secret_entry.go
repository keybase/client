package libkb

import (
	"fmt"
	"io"
)

type SecretEntry struct {
	pinentry *Pinentry
	terminal Terminal
	initRes  *error
}

func NewSecretEntry() *SecretEntry {
	return &SecretEntry{}
}

func (se *SecretEntry) Init() (err error) {

	G.Log.Debug("+ SecretEntry.Init()")

	if se.initRes != nil {
		G.Log.Debug("- SecretEntry.Init() -> cached %s", ErrToOk(*se.initRes))
		return *se.initRes
	}

	se.terminal = G.Terminal

	if G.Env.GetNoPinentry() {
		G.Log.Debug("| Pinentry skipped due to config")
	} else {
		pe := NewPinentry()
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

	G.Log.Debug("- SecretEntry.Init() -> %s", ErrToOk(err))
	return err
}

func (se *SecretEntry) Get(arg SecretEntryArg, term_arg *SecretEntryArg) (
	res *SecretEntryRes, err error) {

	if err = se.Init(); err != nil {
		return
	}

	if pe := se.pinentry; pe != nil {
		res, err = pe.Get(arg)
	} else {
		if term_arg == nil {
			term_arg = &arg
		}
		res, err = TerminalGetSecret(se.terminal, term_arg)
	}

	return
}

func TerminalGetSecret(t Terminal, arg *SecretEntryArg) (
	res *SecretEntryRes, err error) {

	desc := arg.Desc
	prompt := arg.Prompt

	if len(arg.Error) > 0 {
		G.Log.Error(arg.Error)
	}

	if len(desc) > 0 {
		if err = t.Write(desc + "\n"); err != nil {
			return
		}
	}

	var txt string
	txt, err = t.PromptPassword(prompt)

	if err != nil {
		if err == io.EOF {
			err = nil
			res = &SecretEntryRes{Canceled: true}
		}
	} else {
		res = &SecretEntryRes{Text: txt}
	}

	return
}

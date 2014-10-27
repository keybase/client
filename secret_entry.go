package libkb

import (
	"fmt"
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

	if se.initRes != nil {
		return *se.initRes
	}

	se.terminal = G.Terminal

	pe := NewPinentry()

	if e2 := pe.Init(); e2 == nil {
		se.pinentry = pe
	} else if se.terminal == nil {
		err = fmt.Errorf("No terminal and pinentry init failed w/ %s", e2.Error())
	}

	pe.initRes = &err

	return err
}

func (se *SecretEntry) Get(arg *SecretEntryArg) (res *SecretEntryRes, err error) {

	if err = se.Init(); err != nil {
		return
	}

	if pe := se.pinentry; pe != nil {
		res, err = pe.Get(arg)
	} else {
		res, err = TerminalGetSecret(se.terminal, arg)
	}

	return
}

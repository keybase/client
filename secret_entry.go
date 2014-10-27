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

	pe := NewPinentry()

	if e2 := pe.Init(); e2 == nil {
		se.pinentry = pe
		G.Log.Debug("| Pinentry initialized")
	} else if se.terminal == nil {
		err = fmt.Errorf("No terminal and pinentry init failed w/ %s", e2.Error())
	}

	pe.initRes = &err

	G.Log.Debug("- SecretEntry.Init() -> %s", ErrToOk(err))
	return err
}

func (se *SecretEntry) Get(arg SecretEntryArg) (res *SecretEntryRes, err error) {

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

func TerminalGetSecret(t Terminal, arg SecretEntryArg) (
	res *SecretEntryRes, err error) {

	var desc string
	if arg.TerminalDesc != nil {
		desc = *arg.TerminalDesc
	} else {
		desc = arg.Desc
	}
	var prompt string
	if arg.TerminalPrompt != nil {
		prompt = *arg.TerminalPrompt
	} else {
		prompt = arg.Prompt
	}

	if len(desc) > 0 {
		if err = t.Write(desc + "\n"); err != nil {
			return
		}
	}

	var txt string
	txt, err = t.PromptPassword(prompt)
	fmt.Println("fooo")
	fmt.Println(txt)
	if err != nil {
		fmt.Printf(err.Error())
	}

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

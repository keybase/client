package client

import (
	"io"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/minterm"
	keybase1 "github.com/keybase/client/protocol/go"
)

type Terminal struct {
	engine *minterm.MinTerm
}

func NewTerminal() (*Terminal, error) {
	eng, err := minterm.New()
	if err != nil {
		return nil, err
	}
	return &Terminal{engine: eng}, nil
}

func (t Terminal) Shutdown() error {
	return t.engine.Shutdown()
}

func (t Terminal) PromptPassword(s string) (string, error) {
	return t.engine.PromptPassword(s)
}

func (t Terminal) Write(s string) error {
	return t.engine.Write(s)
}

func (t Terminal) Prompt(s string) (string, error) {
	return t.engine.Prompt(s)
}

func (t Terminal) PromptYesNo(p string, def PromptDefault) (ret bool, err error) {
	var ch string
	switch def {
	case PromptDefaultNeither:
		ch = "[y/n]"
	case PromptDefaultYes:
		ch = "[Y/n]"
	case PromptDefaultNo:
		ch = "[y/N]"
	}
	prompt := p + " " + ch + " "
	done := false
	for !done && err == nil {
		var s string
		if s, err = t.Prompt(prompt); err != nil {
		} else if libkb.IsYes(s) {
			ret = true
			done = true
		} else if libkb.IsNo(s) {
			ret = false
			done = true
		} else if libkb.IsEmpty(s) {
			if def == PromptDefaultNo {
				ret = false
				done = true
			} else if def == PromptDefaultYes {
				ret = true
				done = true
			}
		}
	}
	return
}

func (t Terminal) GetSize() (int, int) {
	return t.engine.Size()
}

func (t Terminal) GetSecret(arg *keybase1.SecretEntryArg) (res *keybase1.SecretEntryRes, err error) {

	desc := arg.Desc
	prompt := arg.Prompt

	if len(arg.Err) > 0 {
		G.Log.Error(arg.Err)
	}

	if len(desc) > 0 {
		if err = t.Write(desc + "\n"); err != nil {
			return
		}
	}

	var txt string
	txt, err = t.PromptPassword(prompt)

	if err != nil {
		if err == io.EOF || err == minterm.ErrPromptInterrupted {
			err = nil
			res = &keybase1.SecretEntryRes{Canceled: true}
		}
	} else {
		res = &keybase1.SecretEntryRes{Text: txt}
	}

	if arg.UseSecretStore {
		// TODO: Default to 'No' and dismiss the question for
		// about a day if 'No' is selected.
		res.StoreSecret, err = t.PromptYesNo(libkb.GetTerminalPrompt(), PromptDefaultYes)
		if err != nil {
			return
		}
	}

	return
}

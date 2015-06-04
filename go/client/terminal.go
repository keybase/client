package client

import (
	"io"

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

	return
}

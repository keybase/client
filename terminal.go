package main

import (
	"github.com/keybase/go-libkb"
	"io"
)

type Terminal struct {
	engine *TerminalEngine
}

func NewTerminal() *Terminal {
	return &Terminal{NewTerminalEngine()}
}
func (t Terminal) Startup() error {
	return t.engine.Startup()
}
func (t Terminal) Init() error {
	return t.engine.Init()
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

func (t Terminal) GetSecret(arg *libkb.SecretEntryArg) (res *libkb.SecretEntryRes, err error) {

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
			res = &libkb.SecretEntryRes{Canceled: true}
		}
	} else {
		res = &libkb.SecretEntryRes{Text: txt}
	}

	return
}

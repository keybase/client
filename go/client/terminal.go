// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"io"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/minterm"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/terminalescaper"
)

type Terminal struct {
	libkb.Contextified
	once         sync.Once // protects opening the minterm
	engine       *minterm.MinTerm
	escapeWrites bool
}

func NewTerminalEscaped(g *libkb.GlobalContext) *Terminal {
	return &Terminal{Contextified: libkb.NewContextified(g), escapeWrites: true}
}

func NewTerminalUnescaped(g *libkb.GlobalContext) *Terminal {
	return &Terminal{Contextified: libkb.NewContextified(g), escapeWrites: false}
}

func (t *Terminal) open() error {
	var err error
	t.once.Do(func() {
		if t.engine != nil {
			return
		}
		var eng *minterm.MinTerm
		eng, err = minterm.New()
		if err != nil {
			return
		}
		t.engine = eng
	})
	return err
}

func (t *Terminal) Shutdown() error {
	if t.engine == nil {
		return nil
	}
	return t.engine.Shutdown()
}

func (t *Terminal) PromptPassword(s string) (string, error) {
	if err := t.open(); err != nil {
		return "", err
	}
	return t.engine.PromptPassword(s)
}

func (t *Terminal) Prompt(s string) (string, error) {
	if err := t.open(); err != nil {
		return "", err
	}
	s, err := t.engine.Prompt(s)
	if err == minterm.ErrPromptInterrupted {
		err = libkb.CanceledError{M: "input canceled"}
	}
	return s, err
}

func (t *Terminal) PromptYesNo(p string, def libkb.PromptDefault) (ret bool, err error) {
	if err := t.open(); err != nil {
		return false, err
	}

	var ch string
	switch def {
	case libkb.PromptDefaultNeither:
		ch = "[y/n]"
	case libkb.PromptDefaultYes:
		ch = "[Y/n]"
	case libkb.PromptDefaultNo:
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
			if def == libkb.PromptDefaultNo {
				ret = false
				done = true
			} else if def == libkb.PromptDefaultYes {
				ret = true
				done = true
			}
		}
	}
	return
}

// GetSize tries to get the size for the current terminal.
// It if fails it returns 80x24
func (t *Terminal) GetSize() (int, int) {
	if err := t.open(); err != nil {
		return 80, 24
	}
	return t.engine.Size()
}

func (t *Terminal) GetSecret(arg *keybase1.SecretEntryArg) (res *keybase1.SecretEntryRes, err error) {

	if err := t.open(); err != nil {
		return nil, err
	}

	desc := arg.Desc
	prompt := arg.Prompt

	if len(arg.Err) > 0 {
		t.G().Log.Error(arg.Err)
	}

	s := ""
	if len(desc) > 0 {
		d := desc + "\n"
		if t.escapeWrites {
			d = terminalescaper.Clean(d)
		}
		s += d
	}
	s += prompt

	var txt string
	if arg.ShowTyping {
		txt, err = t.Prompt(s)
	} else {
		txt, err = t.PromptPassword(s)
	}

	if err == io.EOF || err == minterm.ErrPromptInterrupted || len(txt) == 0 {
		err = nil
		res = &keybase1.SecretEntryRes{Canceled: true}
	} else if err == nil {
		res = &keybase1.SecretEntryRes{Text: txt}
	}

	return
}

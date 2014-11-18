package main

import (
	"github.com/keybase/go-libkb"
	"strings"
)

type Field struct {
	Name        string
	Prompt      string
	FirstPrompt string
	Defval      string
	Hint        string
	Checker     *libkb.Checker
	Thrower     func(key, value string) error
	Disabled    bool
	Value       string
}

type Prompter struct {
	Fields []Field
	Data   map[string]string
}

func NewPrompter(f []Field) *Prompter {
	return &Prompter{f, make(map[string]string)}
}

func (p *Prompter) Run() error {
	for _, f := range p.Fields {
		if f.Disabled {
		} else if err := p.ReadField(&f); err != nil {
			return err
		}
	}
	return nil
}

func (p Prompter) Get(k string) (string, bool) {
	s, found := p.Data[k]
	return s, found
}

func (p *Prompter) ReadField(f *Field) (err error) {

	done := false
	first := true

	var val string

	term := G_UI.Terminal
	if term == nil {
		return NoTerminalError{}
	}

	for !done && err == nil {

		f.Value = ""

		prompt := f.Prompt
		if first {
			if len(f.FirstPrompt) > 0 {
				prompt += f.FirstPrompt
			}
			first = false
		} else {
			hint := f.Hint
			if len(hint) == 0 {
				hint = f.Checker.Hint
			}
			prompt += " (" + hint + ")"
		}

		var def string
		if len(f.Defval) == 0 {
			def = f.Defval
		} else if s, found := p.Data[f.Name]; found {
			def = s
		}

		if len(def) > 0 {
			prompt += " [" + def + "]"
		}
		prompt += ": "

		if val, err = term.Prompt(prompt); err != nil {
			break
		}
		f.Value = val

		if len(val) == 0 && len(def) > 0 {
			val = def
		}

		if f.Checker == nil || !f.Checker.PreserveSpace {
			val = strings.TrimSpace(val)
		}

		if f.Thrower != nil {
			if err = f.Thrower(f.Name, val); err != nil {
				break
			}
		}
		if f.Checker != nil {
			done = f.Checker.F(val)
		} else {
			done = true
		}
	}

	if err != nil {
		p.Data[f.Name] = val
	}

	return nil
}

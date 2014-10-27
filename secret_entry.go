package libkb

import ()

type SecretEntry struct {
	pinentry *Pinentry
	terminal Terminal
	initRes  *error
}

func NewSecretEntry() *SecretEntry {
	return &SecretEntry{}
}

func (pe *SecretEntry) Init() error {
	if pe.initRes != nil {
		return *pe.initRes
	}
	pe.pinentry = NewPinentry()
	pe.terminal = G.Terminal
	err := pe.pinentry.Init()
	pe.initRes = &err
	return err
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// Unlock is an engine.
type Unlock struct {
	libkb.Contextified
	passphrase string
}

// NewUnlock creates a Unlock engine.
func NewUnlock(g *libkb.GlobalContext) *Unlock {
	return &Unlock{
		Contextified: libkb.NewContextified(g),
	}
}

// NewUnlock creates a Unlock engine.
func NewUnlockWithPassphrase(g *libkb.GlobalContext, passphrase string) *Unlock {
	return &Unlock{
		Contextified: libkb.NewContextified(g),
		passphrase:   passphrase,
	}
}

// Name is the unique engine name.
func (e *Unlock) Name() string {
	return "Unlock"
}

// GetPrereqs returns the engine prereqs.
func (e *Unlock) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *Unlock) RequiredUIs() []libkb.UIKind {
	if e.passphrase != "" {
		return nil
	}
	return []libkb.UIKind{libkb.SecretUIKind}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Unlock) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *Unlock) Run(m libkb.MetaContext) (err error) {
	defer m.Trace("Unlock#Run", func() error { return err })()

	un := m.CurrentUsername()
	m.Debug("Active device: %+v", *m.ActiveDevice())
	if un.IsNil() {
		return libkb.NewNoUsernameError()
	}
	m = m.WithNewProvisionalLoginContext()
	if e.passphrase == "" {
		err = libkb.PassphraseLoginPromptThenSecretStore(m, un.String(), 5, false /* failOnStoreError */)
	} else {
		err = libkb.PassphraseLoginNoPromptThenSecretStore(m, un.String(), e.passphrase, false /* failOnStoreError */)
	}
	if err != nil {
		return err
	}
	m.CommitProvisionalLogin()

	return nil
}

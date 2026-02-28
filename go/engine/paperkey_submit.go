// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// PaperKeySubmit is an engine.
type PaperKeySubmit struct {
	libkb.Contextified
	paperPhrase    string
	deviceWithKeys *libkb.DeviceWithKeys
}

// NewPaperKeySubmit creates a PaperKeySubmit engine.
func NewPaperKeySubmit(g *libkb.GlobalContext, paperPhrase string) *PaperKeySubmit {
	return &PaperKeySubmit{
		Contextified: libkb.NewContextified(g),
		paperPhrase:  paperPhrase,
	}
}

// Name is the unique engine name.
func (e *PaperKeySubmit) Name() string {
	return "PaperKeySubmit"
}

// Prereqs returns the engine prereqs.
func (e *PaperKeySubmit) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs.
func (e *PaperKeySubmit) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PaperKeySubmit) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&PaperKeyGen{},
	}
}

// Run starts the engine.
func (e *PaperKeySubmit) Run(m libkb.MetaContext) error {
	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m))
	if err != nil {
		return err
	}

	e.deviceWithKeys, err = matchPaperKey(m, me, e.paperPhrase)
	if err != nil {
		return err
	}

	m.ActiveDevice().CacheProvisioningKey(m, e.deviceWithKeys)

	// send a notification that a paper key has been cached
	// for rekey purposes
	m.G().NotifyRouter.HandlePaperKeyCached(me.GetUID(), e.deviceWithKeys.EncryptionKey().GetKID(), e.deviceWithKeys.SigningKey().GetKID())

	// XXX - this is temporary until KBFS handles the above notification
	m.G().UserChanged(m.Ctx(), me.GetUID())

	return nil
}

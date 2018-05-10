// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type ProfileEdit struct {
	libkb.Contextified
	arg keybase1.ProfileEditArg
}

func NewProfileEdit(g *libkb.GlobalContext, arg keybase1.ProfileEditArg) *ProfileEdit {
	return &ProfileEdit{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

func (e *ProfileEdit) Run(m libkb.MetaContext) (err error) {
	defer m.CTrace("ProfileEdit#Run", func() error { return err })()
	_, err = m.G().API.Post(libkb.APIArg{
		Endpoint:    "profile-edit",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"bio":       libkb.S{Val: e.arg.Bio},
			"full_name": libkb.S{Val: e.arg.FullName},
			"location":  libkb.S{Val: e.arg.Location},
		},
		NetContext: m.Ctx(),
	})
	if err != nil {
		return err
	}
	u := m.G().ActiveDevice.UID()
	m.CDebugf("Clearing Card cache for %s", u)
	e.G().CardCache.Delete(u)
	return nil
}

// Name is the unique engine name.
func (e *ProfileEdit) Name() string {
	return "ProfileEdit"
}

// GetPrereqs returns the engine prereqs (none).
func (e *ProfileEdit) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *ProfileEdit) RequiredUIs() []libkb.UIKind {
	return nil
}

func (e *ProfileEdit) SubConsumers() []libkb.UIConsumer {
	return nil
}

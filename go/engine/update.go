// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/sources"
)

type UpdateEngine struct {
	libkb.Contextified
	options keybase1.UpdateOptions
	Result  *keybase1.Update
}

func NewUpdateEngine(g *libkb.GlobalContext, options keybase1.UpdateOptions) *UpdateEngine {
	return &UpdateEngine{
		Contextified: libkb.NewContextified(g),
		options:      options,
	}
}

func (u *UpdateEngine) Name() string {
	return "Updater"
}

func (u *UpdateEngine) Prereqs() Prereqs {
	return Prereqs{}
}

func (u *UpdateEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.UpdateUIKind,
	}
}

func (u *UpdateEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (u *UpdateEngine) Run(ctx *Context) (err error) {
	u.G().Log.Debug("+ UpdateEngine Run")
	defer func() {
		u.G().Log.Debug("- UpdateEngine Run")
	}()

	source, err := sources.NewUpdateSourceFromString(u.G(), u.options.Source)
	if err != nil {
		return
	}

	updr := updater.NewUpdater(u.G(), u.options, source)
	update, err := updr.Update(ctx.UpdateUI, u.options.Force, true)
	if err != nil {
		return
	}
	u.Result = update
	return
}

// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

type LoginCheckAutoresetEngine struct {
	libkb.Contextified
}

func NewLoginCheckAutoresetEngine(g *libkb.GlobalContext) *LoginCheckAutoresetEngine {
	return &LoginCheckAutoresetEngine{
		Contextified: libkb.NewContextified(g),
	}
}

func (e *LoginCheckAutoresetEngine) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *LoginCheckAutoresetEngine) Name() string {
	return "LoginCheckAutoresetEngine"
}

func (e *LoginCheckAutoresetEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LoginUIKind,
	}
}

func (e *LoginCheckAutoresetEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *LoginCheckAutoresetEngine) Run(m libkb.MetaContext) (err error) {
	arg := libkb.NewRetryAPIArg("autoreset/status")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	res, err := m.G().API.Get(m, arg)
	if err != nil {
		return err
	}
	m.G().Log.Error("Autoreset dump %s", res.Body.MarshalToDebug())
	resetID := res.Body.AtKey("reset_id")
	if resetID.IsNil() {
		// There's no autoreset pending
		return nil
	}

	delaySecs, err := res.Body.AtKey("delay_secs").GetInt()
	if err != nil {
		return err
	}
	eventType, err := res.Body.AtKey("event_type").GetInt()
	if err != nil {
		return err
	}

	switch eventType {
	case libkb.AutoresetEventReady:
		// User _must_ reset or cancel
		if err := libkb.AutoresetReadyPrompt(m); err != nil {
			return err
		}
	case libkb.AutoresetEventVerify:
		// User _can_ cancel
		if err := libkb.AutoresetNotifyPrompt(m, delaySecs); err != nil {
			return err
		}
	default:
		return nil // we've probably just resetted/cancelled
	}

	return nil
}

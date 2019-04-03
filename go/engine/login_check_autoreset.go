// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"time"

	humanize "github.com/dustin/go-humanize"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
		libkb.ResetUIKind,
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

	eventTimeStr, err := res.Body.AtKey("event_time").GetString()
	if err != nil {
		return err
	}
	eventTime, err := time.Parse(time.RFC3339, eventTimeStr)
	if err != nil {
		return err
	}
	delaySecs, err := res.Body.AtKey("delay_secs").GetInt()
	if err != nil {
		return err
	}
	eventType, err := res.Body.AtKey("event_type").GetInt()
	if err != nil {
		return err
	}

	rui := m.UIs().ResetUI
	if rui == nil {
		// No reset UI present
		return nil
	}

	var promptRes keybase1.ResetPromptResult
	switch eventType {
	case libkb.AutoresetEventReady:
		// User can reset or cancel
		promptRes, err = rui.ResetPrompt(m.Ctx(), keybase1.ResetPromptArg{
			Reset: true,
			Text:  "You can reset your account.",
		})
		if err != nil {
			return err
		}
	case libkb.AutoresetEventVerify:
		// User can only cancel
		promptRes, err = rui.ResetPrompt(m.Ctx(), keybase1.ResetPromptArg{
			Text: fmt.Sprintf(
				"Your account will be resetable in %s.",
				humanize.Time(eventTime.Add(time.Second*time.Duration(delaySecs))),
			),
		})
		if err != nil {
			return err
		}
	default:
		return nil // we've probably just resetted/cancelled
	}

	switch promptRes {
	case keybase1.ResetPromptResult_CANCEL:
		m.G().Log.Error("Would cancel")
		return nil
	case keybase1.ResetPromptResult_RESET:
		m.G().Log.Error("Would reset")
		return nil
	default:
		// Ignore
		return nil
	}
}

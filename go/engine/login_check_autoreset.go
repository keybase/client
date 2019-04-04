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

type loginCheckAutoresetEngine struct {
	libkb.Contextified
	arg   loginCheckAutoresetArgs
	reset bool
}

type loginCheckAutoresetArgs struct {
	username string
}

func newLoginCheckAutoresetEngine(g *libkb.GlobalContext, arg loginCheckAutoresetArgs) *loginCheckAutoresetEngine {
	return &loginCheckAutoresetEngine{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

func (e *loginCheckAutoresetEngine) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *loginCheckAutoresetEngine) Name() string {
	return "loginCheckAutoresetEngine"
}

func (e *loginCheckAutoresetEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.ResetUIKind,
	}
}

func (e *loginCheckAutoresetEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&loginProvision{},
	}
}

func (e *loginCheckAutoresetEngine) Run(m libkb.MetaContext) (err error) {
	arg := libkb.NewRetryAPIArg("autoreset/status")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	res, err := m.G().API.Get(m, arg)
	if err != nil {
		return err
	}
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
		arg := libkb.NewAPIArg("autoreset/cancel")
		arg.SessionType = libkb.APISessionTypeREQUIRED
		payload := libkb.JSONPayload{
			"src": "app",
		}
		arg.JSONPayload = payload
		if _, err := m.G().API.Post(m, arg); err != nil {
			return err
		}
		m.G().Log.Info("Your account's reset has been canceled.")
		return nil
	case keybase1.ResetPromptResult_RESET:
		arg := libkb.NewAPIArg("autoreset/reset")
		arg.SessionType = libkb.APISessionTypeREQUIRED
		payload := libkb.JSONPayload{
			"src": "app",
		}
		arg.JSONPayload = payload
		if _, err := m.G().API.Post(m, arg); err != nil {
			return err
		}
		m.G().Log.Info("Your account has been reset.")
		e.reset = true
		return nil
	default:
		// Ignore
		return nil
	}
}

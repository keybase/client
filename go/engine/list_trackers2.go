// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type ListTrackers2Engine struct {
	libkb.Contextified
	arg keybase1.ListTrackers2Arg
	res keybase1.UserSummary2Set
	uid keybase1.UID
}

func NewListTrackers2(g *libkb.GlobalContext, arg keybase1.ListTrackers2Arg) *ListTrackers2Engine {
	return &ListTrackers2Engine{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// Name is the unique engine name.
func (e *ListTrackers2Engine) Name() string {
	return "ListTrackersEngine"
}

// GetPrereqs returns the engine prereqs (none).
func (e *ListTrackers2Engine) Prereqs() Prereqs {
	session := false
	if len(e.arg.Assertion) == 0 {
		session = true
	}
	return Prereqs{Device: session}
}

func (e *ListTrackers2Engine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.LogUIKind}
}

func (e *ListTrackers2Engine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *ListTrackers2Engine) lookupUID(m libkb.MetaContext) error {
	if len(e.arg.Assertion) == 0 {
		e.uid = m.G().GetMyUID()
		if !e.uid.Exists() {
			return libkb.NoUIDError{}
		}
		return nil
	}

	larg := libkb.NewLoadUserArgWithMetaContext(m).WithPublicKeyOptional().WithName(e.arg.Assertion)
	u, err := libkb.LoadUser(larg)
	if err != nil {
		return err
	}
	e.uid = u.GetUID()
	return nil
}

func (e *ListTrackers2Engine) Run(m libkb.MetaContext) error {
	if err := e.lookupUID(m); err != nil {
		return err
	}
	callerUID := m.G().Env.GetUID()
	ts := libkb.NewTracker2Syncer(m.G(), callerUID, e.arg.Reverse)
	if err := libkb.RunSyncer(m, ts, e.uid, false /* loggedIn */, false /* forceReload */); err != nil {
		return err
	}
	e.res = ts.Result()
	return nil
}

func (e *ListTrackers2Engine) GetResults() keybase1.UserSummary2Set {
	return e.res
}

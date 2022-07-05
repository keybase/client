// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type ListTrackersUnverifiedEngine struct {
	libkb.Contextified
	arg ListTrackersUnverifiedEngineArg
	res keybase1.UserSummarySet
}

// If a UID is given, the engine will list its trackers
// If an Assertion is given, the engine will try to resolve it to a UID via
// remote unless CachedOnly is true.
// Otherwise, the logged-in uid is used.
// If no user is logged in, NoUIDError is returned.
type ListTrackersUnverifiedEngineArg struct {
	UID        keybase1.UID
	Assertion  string
	CachedOnly bool
}

func NewListTrackersUnverifiedEngine(g *libkb.GlobalContext, arg ListTrackersUnverifiedEngineArg) *ListTrackersUnverifiedEngine {
	return &ListTrackersUnverifiedEngine{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// Name is the unique engine name.
func (e *ListTrackersUnverifiedEngine) Name() string {
	return "ListTrackersUnverifiedEngine"
}

func (e *ListTrackersUnverifiedEngine) Prereqs() Prereqs {
	session := false
	if len(e.arg.Assertion) == 0 && e.arg.UID.IsNil() {
		session = true
	}
	return Prereqs{Device: session}
}

func (e *ListTrackersUnverifiedEngine) RequiredUIs() []libkb.UIKind {
	return nil
}

func (e *ListTrackersUnverifiedEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

// lookupUID prefers 1) the given uid if provided 2) assertion if provided 3) logged in uid
func lookupUID(m libkb.MetaContext, uid keybase1.UID, assertion string, cachedOnly bool) (ret keybase1.UID, err error) {
	// If we're given the uid explicitly, use it.
	if uid.Exists() {
		return uid, nil
	}
	// Otherwise,
	if len(assertion) != 0 {
		if cachedOnly {
			return ret, errors.New("cannot lookup assertion in CachedOnly mode")
		}

		larg := libkb.NewLoadUserArgWithMetaContext(m).WithPublicKeyOptional().WithName(assertion)
		upk, _, err := m.G().GetUPAKLoader().LoadV2(larg)
		if err != nil {
			return ret, err
		}
		return upk.GetUID(), nil
	}

	uid = m.G().GetMyUID()
	if uid.Exists() {
		return uid, nil
	}

	return ret, libkb.NoUIDError{}
}

func (e *ListTrackersUnverifiedEngine) Run(m libkb.MetaContext) error {
	uid, err := lookupUID(m, e.arg.UID, e.arg.Assertion, e.arg.CachedOnly)
	if err != nil {
		return err
	}

	callerUID := m.G().Env.GetUID()
	ts := libkb.NewServertrustTrackerSyncer(m.G(), callerUID, libkb.FollowDirectionFollowers)

	if e.arg.CachedOnly {
		if err := libkb.RunSyncerCached(m, ts, uid); err != nil {
			return err
		}
		e.res = ts.Result()
		return nil
	}

	if err := libkb.RunSyncer(m, ts, uid, false /* loggedIn */, false /* forceReload */); err != nil {
		return err
	}
	e.res = ts.Result()
	return nil
}

func (e *ListTrackersUnverifiedEngine) GetResults() keybase1.UserSummarySet {
	return e.res
}

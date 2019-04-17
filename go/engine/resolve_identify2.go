// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"

	gregor "github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type ResolveThenIdentify2 struct {
	libkb.Contextified
	arg                   *keybase1.Identify2Arg
	i2eng                 *Identify2WithUID
	testArgs              *Identify2WithUIDTestArgs
	responsibleGregorItem gregor.Item
	queriedName           libkb.NormalizedUsername

	// When tracking is being performed, the identify engine is used with a tracking ui.
	// These options are sent to the ui based on command line options.
	// For normal identify, safe to leave these in their default zero state.
	trackOptions keybase1.TrackOptions
}

var _ (Engine2) = (*ResolveThenIdentify2)(nil)

func NewResolveThenIdentify2(g *libkb.GlobalContext, arg *keybase1.Identify2Arg) *ResolveThenIdentify2 {
	return &ResolveThenIdentify2{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

func NewResolveThenIdentify2WithTrack(g *libkb.GlobalContext, arg *keybase1.Identify2Arg, topts keybase1.TrackOptions) *ResolveThenIdentify2 {
	return &ResolveThenIdentify2{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
		trackOptions: topts,
	}
}

// Name is the unique engine name.
func (e *ResolveThenIdentify2) Name() string {
	return "ResolveThenIdentify2"
}

// GetPrereqs returns the engine prereqs.
func (e *ResolveThenIdentify2) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *ResolveThenIdentify2) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *ResolveThenIdentify2) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&Identify2WithUID{
			arg: e.arg,
		},
	}
}

func (e *ResolveThenIdentify2) resolveUID(m libkb.MetaContext) (err error) {
	if !e.arg.Uid.IsNil() {
		return nil
	}

	// if no uid and no assertion, then if logged in use self uid:
	if len(e.arg.UserAssertion) == 0 && e.arg.AllowEmptySelfID {
		ok, uid := isLoggedIn(m)
		if ok {
			e.arg.Uid = uid
			return nil
		}
		return libkb.LoginRequiredError{Context: "to identify without specifying a user assertion"}
	}

	rres := m.G().Resolver.ResolveFullExpressionWithBody(m, e.arg.UserAssertion)
	if err = rres.GetError(); err != nil {
		m.Debug("ResolveThenIdentify2#resolveUID: failing assertion for arg %+v", e.arg)
		return err
	}
	e.arg.Uid = rres.GetUID()
	if rres.WasKBAssertion() && !e.arg.NeedProofSet {
		m.Debug("Assertion was 'KB' and we don't need proofset: %s", e.arg.UserAssertion)
		// the resolve assertion was a keybase username or UID, so remove it
		// from identify2 arg to allow cache hits on UID.
		e.arg.UserAssertion = ""
		// But still check on that way out that the username matches the UID
		e.queriedName = rres.GetNormalizedQueriedUsername()
	}

	// An optimization --- plumb through the resolve body for when we load the
	// user. This will save a round trip to the server.
	e.i2eng.ResolveBody = rres.GetBody()

	return nil
}

func (e *ResolveThenIdentify2) nameResolutionPostAssertion(m libkb.MetaContext) (err error) {
	// Check the server for cheating on a Name->UID resolution. After we do a userload (by UID),
	// we should have a merkle-verified idea of what the corresponding name is, so we check it
	// as a post-assertion here.
	if e.queriedName.IsNil() {
		return nil
	}
	res, err := e.Result(m)
	if err != nil {
		return err
	}
	if !libkb.NewNormalizedUsername(res.Upk.GetName()).Eq(e.queriedName) {
		return libkb.NewUIDMismatchError("bad user returned for " + e.queriedName.String())
	}
	return nil
}

func (e *ResolveThenIdentify2) Run(m libkb.MetaContext) (err error) {
	m = m.WithLogTag("ID2")

	defer m.TraceTimed("ResolveThenIdentify2#Run", func() error { return err })()

	e.i2eng = NewIdentify2WithUID(m.G(), e.arg)
	if e.responsibleGregorItem != nil {
		e.i2eng.SetResponsibleGregorItem(e.responsibleGregorItem)
	}
	e.i2eng.trackOptions = e.trackOptions

	if err = e.resolveUID(m); err != nil {
		return err
	}

	// For testing
	e.i2eng.testArgs = e.testArgs
	if err = RunEngine2(m, e.i2eng); err != nil {
		return err
	}

	if err = e.nameResolutionPostAssertion(m); err != nil {
		return err
	}
	return nil
}

func (e *ResolveThenIdentify2) Result(m libkb.MetaContext) (*keybase1.Identify2ResUPK2, error) {
	if e.i2eng == nil {
		return nil, errors.New("ResolveThenIdentify2#Result: no result available if the engine did not run")
	}
	return e.i2eng.Result(m)
}

func (e *ResolveThenIdentify2) SetResponsibleGregorItem(item gregor.Item) {
	e.responsibleGregorItem = item
}

func (e *ResolveThenIdentify2) TrackToken() keybase1.TrackToken {
	return e.i2eng.TrackToken()
}

func (e *ResolveThenIdentify2) ConfirmResult() keybase1.ConfirmResult {
	return e.i2eng.ConfirmResult()
}

func (e *ResolveThenIdentify2) GetProofSet() *libkb.ProofSet {
	if e.i2eng == nil {
		return nil
	}
	return e.i2eng.GetProofSet()
}

func (e *ResolveThenIdentify2) GetIdentifyOutcome() *libkb.IdentifyOutcome {
	if e.i2eng == nil {
		return nil
	}
	return e.i2eng.GetIdentifyOutcome()
}

// ResolveAndCheck takes as input a name (joe), social assertion (joe@twitter)
// or compound assertion (joe+joe@twitter+3883883773222@pgp) and resolves
// it to a user, verifying the result. Pass into it a MetaContext without any UIs set,
// since it is meant to run without any UI interaction. Tracking statements
// are optionally taken into account (see flag). No ID2-specific caching will be used,
// but the UPAK cache will be used, and busted with ForceRepoll semantics. The output, on success,
// is a populated UserPlusKeysV2.
func ResolveAndCheck(m libkb.MetaContext, s string, useTracking bool) (ret keybase1.UserPlusKeysV2, err error) {

	m = m.WithLogTag("RAC")
	defer m.TraceTimed("ResolveAndCheck", func() error { return err })()

	arg := keybase1.Identify2Arg{
		UserAssertion:         s,
		CanSuppressUI:         true,
		ActLoggedOut:          !useTracking,
		NoErrorOnTrackFailure: !useTracking,
		IdentifyBehavior:      keybase1.TLFIdentifyBehavior_RESOLVE_AND_CHECK,
	}
	eng := NewResolveThenIdentify2(m.G(), &arg)
	if err = RunEngine2(m, eng); err != nil {
		return ret, err
	}
	res, err := eng.Result(m)
	if err != nil {
		return ret, err
	}
	// Success path.
	return res.Upk.Current, nil
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
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

	rres := m.G().Resolver.ResolveFullExpressionWithBody(m.Ctx(), e.arg.UserAssertion)
	if err = rres.GetError(); err != nil {
		return err
	}
	e.arg.Uid = rres.GetUID()
	if rres.WasKBAssertion() && !e.arg.NeedProofSet {
		m.CDebugf("Assertion was 'KB' and we don't need proofset: %s", e.arg.UserAssertion)
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

func (e *ResolveThenIdentify2) Run(m libkb.MetaContext) (err error) {
	m = m.WithLogTag("ID2")

	defer m.CTraceTimed("ResolveThenIdentify2#Run", func() error { return err })()

	e.i2eng = NewIdentify2WithUID(m.G(), e.arg)
	if e.responsibleGregorItem != nil {
		e.i2eng.SetResponsibleGregorItem(e.responsibleGregorItem)
	}
	e.i2eng.trackOptions = e.trackOptions

	if err = e.resolveUID(m); err != nil {
		return
	}

	// For testing
	e.i2eng.testArgs = e.testArgs
	err = RunEngine2(m, e.i2eng)
	if err != nil {
		return err
	}

	// Check the server for cheating on a Name->UID resolution. After we do a userload (by UID),
	// we should have a merkle-verified idea of what the corresponding name is, so we check it
	// as a post-assertion here.
	if !e.queriedName.IsNil() && !libkb.NewNormalizedUsername(e.Result().Upk.GetName()).Eq(e.queriedName) {
		return libkb.NewUIDMismatchError("bad user returned for " + e.queriedName.String())
	}
	return nil
}

func (e *ResolveThenIdentify2) Result() *keybase1.Identify2Res {
	if e.i2eng == nil {
		return nil
	}
	return e.i2eng.Result()
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

// ResolveAndCheck takes as input a name (joe), social assertion (joe@twitter)
// or compound assertion (joe+joe@twitter+3883883773222@pgp) and resolves
// it to a user, verifying the result. Pass into it a MetaContext without any UIs set,
// since it is meant to run without any UI interaction. Also note that tracker statements
// are *not* taken into account. No ID2-specific caching will be used, but the UPAK
// cache will be used, and busted with ForceRepoll semantics. The output, on success,
// is a populated UserPlusKeysV2.
func ResolveAndCheck(m libkb.MetaContext, s string) (ret keybase1.UserPlusKeysV2, err error) {

	// Invokes the whole resolve/identify machinery. That is, it performs a server-trusted
	// resolution of the name to a UID, then does an ID on the UID to make sure all
	// assertions are met. The identify is run as if the user is logged out.

	m = m.WithLogTag("RAC")
	defer m.CTraceTimed("ResolveAndCheck", func() error { return err })()

	arg := keybase1.Identify2Arg{
		UserAssertion:         s,
		CanSuppressUI:         true,
		ActLoggedOut:          true,
		NoErrorOnTrackFailure: true,
		IdentifyBehavior:      keybase1.TLFIdentifyBehavior_RESOLVE_AND_CHECK,
	}
	eng := NewResolveThenIdentify2(m.G(), &arg)
	err = RunEngine2(m, eng)
	if err != nil {
		return ret, err
	}
	res := eng.Result()

	// Note: this is slightly wasteful since we already loaded a UPAK V1 in Identify2WithUID,
	// (downconverted from a V2), and now we're just reloading the V2. But the alternative was a big
	// refactor, and we're punting on that for now. The good news is this load will almost always hit the
	// cache (see identifyUser#load, which loads both the UPAK and the full user at the same time).
	upk, _, err := m.G().GetUPAKLoader().LoadV2(libkb.NewLoadUserArgWithMetaContext(m).WithUID(res.Upk.GetUID()))
	if err != nil {
		return ret, err
	}
	curr := upk.Current

	// There's a slight chance of a race, that the user reset, so just check we didn't race,
	// and if so, error out.
	if curr.EldestSeqno != res.Upk.EldestSeqno {
		return ret, libkb.NewAccountResetError(curr.ToUserVersion(), res.Upk.EldestSeqno)
	}

	// Success path.
	return curr, nil
}

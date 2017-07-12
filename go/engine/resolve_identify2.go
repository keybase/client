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

	// When tracking is being performed, the identify engine is used with a tracking ui.
	// These options are sent to the ui based on command line options.
	// For normal identify, safe to leave these in their default zero state.
	trackOptions keybase1.TrackOptions
}

var _ (Engine) = (*ResolveThenIdentify2)(nil)

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

func (e *ResolveThenIdentify2) resolveUID(ctx *Context) (err error) {
	if !e.arg.Uid.IsNil() {
		return nil
	}

	// if no uid and no assertion, then if logged in use self uid:
	if len(e.arg.UserAssertion) == 0 && e.arg.AllowEmptySelfID {
		ok, uid, err := IsLoggedIn(e, ctx)
		if ok {
			e.arg.Uid = uid
			return nil
		}
		if err != nil {
			return err
		}
		return libkb.LoginRequiredError{Context: "to identify without specifying a user assertion"}
	}

	rres := e.G().Resolver.ResolveFullExpressionWithBody(ctx.GetNetContext(), e.arg.UserAssertion)
	if err = rres.GetError(); err != nil {
		return err
	}
	e.arg.Uid = rres.GetUID()
	if rres.WasKBAssertion() && !e.arg.NeedProofSet {
		// the resolve assertion was a keybase username or UID, so remove it
		// from identify2 arg to allow cache hits on UID.
		e.arg.UserAssertion = ""
	}

	// An optimization --- plumb through the resolve body for when we load the
	// user. This will save a round trip to the server.
	e.i2eng.ResolveBody = rres.GetBody()

	return nil
}

func (e *ResolveThenIdentify2) Run(ctx *Context) (err error) {
	e.SetGlobalContext(ctx.CloneGlobalContextWithLogTags(e.G(), "ID2"))

	defer e.G().CTraceTimed(ctx.GetNetContext(), "ResolveThenIdentify2#Run", func() error { return err })()

	e.i2eng = NewIdentify2WithUID(e.G(), e.arg)
	if e.responsibleGregorItem != nil {
		e.i2eng.SetResponsibleGregorItem(e.responsibleGregorItem)
	}
	e.i2eng.trackOptions = e.trackOptions

	if err = e.resolveUID(ctx); err != nil {
		return
	}

	// For testing
	e.i2eng.testArgs = e.testArgs

	return RunEngine(e.i2eng, ctx)
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

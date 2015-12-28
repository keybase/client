// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type ResolveThenIdentify2 struct {
	libkb.Contextified
	arg      *keybase1.Identify2Arg
	i2eng    *Identify2WithUID
	testArgs *Identify2WithUIDTestArgs
}

// Name is the unique engine name.
func (e *ResolveThenIdentify2) Name() string {
	return "ResolveThenIdentify2"
}

func NewResolveThenIdentify2(g *libkb.GlobalContext, arg *keybase1.Identify2Arg) *ResolveThenIdentify2 {
	return &ResolveThenIdentify2{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
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
		&Identify2WithUID{},
	}
}

func (e *ResolveThenIdentify2) Run(ctx *Context) (err error) {
	libkb.Trace(e.G().Log, "ResolveThenIdentify2::Run", func() error { return err })

	rres := e.G().Resolver.ResolveFullExpressionWithBody(e.arg.UserAssertion)
	if err = rres.GetError(); err != nil {
		return err
	}
	e.arg.Uid = rres.GetUID()
	e.i2eng = NewIdentify2WithUID(e.G(), e.arg)

	// For testing
	e.i2eng.testArgs = e.testArgs

	// An optimization --- plumb through the resolve body for when we load the
	// user. This will save a round trip to the server.
	e.i2eng.ResolveBody = rres.GetBody()

	return e.i2eng.Run(ctx)
}

func (e *ResolveThenIdentify2) Result() *keybase1.Identify2Res {
	if e.i2eng == nil {
		return nil
	}
	return e.i2eng.Result()
}

var _ (Engine) = (*ResolveThenIdentify2)(nil)

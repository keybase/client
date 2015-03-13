// LUBA = LoadUserByAssertions
//
//  Given an string of the form foo@github+max+boo@twitter,
//  first load the user, and then check all assertions.
//
//  Have to identify the user first via remote-proof-checking.
//

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// Luba is an engine that loads users by assertion.
type Luba struct {
	arg *LubaArg
}

type LubaArg struct {
	Assertion    string
	WithTracking bool
}

// NewLuba creates a Luba engine.
func NewLuba(arg *LubaArg) *Luba {
	return &Luba{arg: arg}
}

// Name is the unique engine name.
func (e *Luba) Name() string {
	return "Luba"
}

// GetPrereqs returns the engine prereqs.
func (e *Luba) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *Luba) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.IdentifyUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Luba) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *Luba) Run(ctx *Context, args, reply interface{}) error {
	return nil
}

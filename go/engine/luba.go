// LUBA = LoadUserByAssertions
//
//  Given an string of the form foo@github+max+boo@twitter,
//  first load the user, and then check all assertions.
//
//  Have to identify the user first via remote-proof-checking.
//

package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// Luba is an engine that loads users by assertion.
type Luba struct {
	arg   *LubaArg
	user  *libkb.User
	idres *libkb.IdentifyOutcome
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
	return EnginePrereqs{Session: e.arg.WithTracking}
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
	// Parse assertion but don't allow OR operators, only
	// AND operators
	expr, err := libkb.AssertionParseAndOnly(e.arg.Assertion)
	if err != nil {
		return err
	}

	// Next, pop off the 'best' assertion and load the user by it.
	// That is, it might be the keybase assertion (if there), or otherwise,
	// something that's unique like Twitter or Github, and lastly,
	// something like DNS that is more likely ambiguous...
	b := e.findBestComponent(expr)
	if len(b) == 0 {
		return fmt.Errorf("Cannot lookup user with %q", e.arg.Assertion)
	}

	larg := libkb.LoadUserArg{Name: b}
	e.user, err = libkb.LoadUser(larg)
	if err != nil {
		return err
	}

	iarg := NewIdentifyArg(e.user.GetName(), e.arg.WithTracking)
	ieng := NewIdentify(iarg)
	if err := RunEngine(ieng, ctx, nil, nil); err != nil {
		return err
	}
	e.idres = ieng.Outcome()

	if !expr.MatchSet(*e.user.ToOkProofSet()) {
		// TODO - Better debugging?
		return fmt.Errorf("User %s didn't match given assertion", e.user.GetName())
	}

	return nil
}

func (e *Luba) User() *libkb.User {
	return e.user
}

func (e *Luba) IdentifyRes() *libkb.IdentifyOutcome {
	return e.idres
}

func (e *Luba) IsTracking() (bool, error) {
	if e.user == nil {
		return false, errors.New("nil user")
	}
	if e.idres == nil {
		return false, fmt.Errorf("user %s, no id result", e.user.GetName())
	}
	tracking := e.idres.TrackUsed != nil
	return tracking, nil
}

func (e *Luba) findBestComponent(expr libkb.AssertionExpression) string {
	urls := make([]libkb.AssertionUrl, 0, 1)
	urls = expr.CollectUrls(urls)
	if len(urls) == 0 {
		return ""
	}

	var uid, kb, soc, fp libkb.AssertionUrl

	for _, u := range urls {
		if u.IsUid() {
			uid = u
			break
		} else if u.IsKeybase() {
			kb = u
		} else if u.IsFingerprint() && fp == nil {
			fp = u
		} else if u.IsSocial() && soc == nil {
			soc = u
		}
	}

	order := []libkb.AssertionUrl{uid, kb, fp, soc, urls[0]}
	for _, p := range order {
		if p != nil {
			return p.String()
		}
	}
	return ""
}

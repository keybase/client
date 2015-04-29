package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// Identify is an engine to identify a user.
type Identify struct {
	arg       *IdentifyArg
	user      *libkb.User
	me        *libkb.User
	userExpr  libkb.AssertionExpression
	outcome   *libkb.IdentifyOutcome
	trackInst *libkb.TrackInstructions
}

type IdentifyArg struct {
	TargetUsername string // The user being identified, leave blank to identify self
	WithTracking   bool   // true if want tracking statement for logged in user on TargetUsername
	AllowSelf      bool   // if we're allowed to id/track ourself

	// When tracking is being performed, the identify engine is used with a tracking ui.
	// These options are sent to the ui based on command line options.
	// For normal identify, safe to leave these in their default zero state.
	TrackOptions TrackOptions
}

func NewIdentifyArg(targetUsername string, withTracking bool) *IdentifyArg {
	return &IdentifyArg{
		TargetUsername: targetUsername,
		WithTracking:   withTracking,
		AllowSelf:      true,
	}
}

func NewIdentifyTrackArg(targetUsername string, withTracking bool, options TrackOptions) *IdentifyArg {
	return &IdentifyArg{
		TargetUsername: targetUsername,
		WithTracking:   withTracking,
		TrackOptions:   options,
		AllowSelf:      false,
	}
}

func (ia *IdentifyArg) SelfID() bool {
	return len(ia.TargetUsername) == 0
}

// NewIdentify creates a Identify engine.
func NewIdentify(arg *IdentifyArg) *Identify {
	return &Identify{arg: arg}
}

// Name is the unique engine name.
func (e *Identify) Name() string {
	return "Identify"
}

// GetPrereqs returns the engine prereqs.
func (e *Identify) GetPrereqs() EnginePrereqs {
	// if WithTracking is on, we need to be logged in
	return EnginePrereqs{Session: e.arg.WithTracking}
}

// RequiredUIs returns the required UIs.
func (e *Identify) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.IdentifyUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Identify) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *Identify) Run(ctx *Context) error {
	if err := e.loadUser(); err != nil {
		return err
	}

	ok, err := IsLoggedIn()
	if err != nil {
		return err
	}
	if ok {
		e.me, err = libkb.LoadMe(libkb.LoadUserArg{})
		if err != nil {
			return err
		}

		if e.user.Equal(e.me) {
			e.arg.WithTracking = false
		} else {
			e.arg.WithTracking = true
		}
	}

	ctx.IdentifyUI.Start(e.user.GetName())

	e.outcome, err = e.run(ctx)
	if err != nil {
		return err
	}

	// set the flags in the outcome with the track options to
	// inform the ui what to do with the remote tracking prompt:
	e.outcome.LocalOnly = e.arg.TrackOptions.TrackLocalOnly
	e.outcome.ApproveRemote = e.arg.TrackOptions.TrackApprove

	tmp, err := ctx.IdentifyUI.FinishAndPrompt(e.outcome.Export())
	if err != nil {
		return err
	}
	fpr := libkb.ImportFinishAndPromptRes(tmp)
	e.trackInst = &fpr

	return nil
}

func (e *Identify) User() *libkb.User {
	return e.user
}

func (e *Identify) Outcome() *libkb.IdentifyOutcome {
	return e.outcome
}

func (e *Identify) TrackInstructions() *libkb.TrackInstructions {
	return e.trackInst
}

func (e *Identify) run(ctx *Context) (*libkb.IdentifyOutcome, error) {
	res := libkb.NewIdentifyOutcome(e.arg.WithTracking)
	is := libkb.NewIdentifyState(res, e.user)

	if e.me != nil && e.user.Equal(e.me) && !e.arg.AllowSelf {
		return nil, libkb.SelfTrackError{}
	}

	if e.arg.WithTracking {

		tlink, err := e.me.GetTrackingStatementFor(e.user.GetName(), e.user.GetUid())
		if err != nil {
			return nil, err
		}
		if tlink != nil {
			is.Track = libkb.NewTrackLookup(tlink)
			res.TrackUsed = is.Track
		}
	}

	ctx.IdentifyUI.ReportLastTrack(libkb.ExportTrackSummary(is.Track))

	G.Log.Debug("+ Identify(%s)", e.user.GetName())

	is.ComputeKeyDiffs(ctx.IdentifyUI.DisplayKey)
	is.InitResultList()
	is.ComputeTrackDiffs()
	is.ComputeDeletedProofs()

	ctx.IdentifyUI.LaunchNetworkChecks(res.ExportToUncheckedIdentity(), e.user.Export())
	e.user.IdTable().Identify(is, ctx.IdentifyUI)

	if !e.userExpr.MatchSet(*e.user.ToOkProofSet()) {
		return nil, fmt.Errorf("User %s didn't match given assertion", e.user.GetName())
	}

	G.Log.Debug("- Identify(%s)", e.user.GetName())

	return res, nil
}

func (e *Identify) loadUser() error {
	arg, err := e.loadUserArg()
	if err != nil {
		return err
	}

	u, err := libkb.LoadUser(*arg)
	if err != nil {
		return err
	}
	e.user = u

	if arg.Self {
		// if this was a self load, need to load an assertion expression
		// now that we have the username
		if err := e.loadExpr(e.user.GetName()); err != nil {
			return err
		}
	}

	return nil
}

func (e *Identify) loadUserArg() (*libkb.LoadUserArg, error) {
	if e.arg.SelfID() {
		// loading self
		return &libkb.LoadUserArg{Self: true}, nil
	}

	// Use assertions for everything:
	if err := e.loadExpr(e.arg.TargetUsername); err != nil {
		return nil, err
	}

	// Next, pop off the 'best' assertion and load the user by it.
	// That is, it might be the keybase assertion (if there), or otherwise,
	// something that's unique like Twitter or Github, and lastly,
	// something like DNS that is more likely ambiguous...
	b := e.findBestComponent(e.userExpr)
	if len(b) == 0 {
		return nil, fmt.Errorf("Cannot lookup user with %q", e.arg.TargetUsername)
	}

	return &libkb.LoadUserArg{Name: b}, nil
}

func (e *Identify) loadExpr(assertion string) error {
	// Parse assertion but don't allow OR operators, only AND operators
	expr, err := libkb.AssertionParseAndOnly(assertion)
	if err != nil {
		return fmt.Errorf("assertion parse error: %s", err)
	}
	e.userExpr = expr
	return nil
}

func (e *Identify) findBestComponent(expr libkb.AssertionExpression) string {
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

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// Identify is an engine to identify a user.
type Identify struct {
	arg              *IdentifyArg
	user             *libkb.User
	me               *libkb.User
	userExpr         libkb.AssertionExpression
	outcome          *libkb.IdentifyOutcome
	trackInst        *libkb.TrackInstructions
	trackToken       keybase1.TrackToken
	selfShortCircuit bool
	libkb.Contextified
}

type IdentifyArg struct {
	TargetUsername   string // The user being identified, leave blank to identify self
	WithTracking     bool   // true if want tracking statement for logged in user on TargetUsername
	AllowSelf        bool   // if we're allowed to id/track ourself
	ForceRemoteCheck bool   // true: skip proof cache and perform all remote proof checks

	// When tracking is being performed, the identify engine is used with a tracking ui.
	// These options are sent to the ui based on command line options.
	// For normal identify, safe to leave these in their default zero state.
	TrackOptions keybase1.TrackOptions

	Source keybase1.ClientType
	Reason keybase1.IdentifyReason
}

func NewIdentifyArg(targetUsername string, withTracking, forceRemoteCheck bool) *IdentifyArg {
	return &IdentifyArg{
		TargetUsername:   targetUsername,
		WithTracking:     withTracking,
		AllowSelf:        true,
		ForceRemoteCheck: forceRemoteCheck,
	}
}

func NewIdentifyTrackArg(targetUsername string, withTracking, forceRemoteCheck bool, options keybase1.TrackOptions) *IdentifyArg {
	return &IdentifyArg{
		TargetUsername:   targetUsername,
		WithTracking:     withTracking,
		TrackOptions:     options,
		AllowSelf:        false,
		ForceRemoteCheck: forceRemoteCheck,
	}
}

func (ia *IdentifyArg) SelfID() bool {
	return len(ia.TargetUsername) == 0
}

// NewIdentify creates a Identify engine.
func NewIdentify(arg *IdentifyArg, g *libkb.GlobalContext) *Identify {
	return &Identify{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *Identify) Name() string {
	return "Identify"
}

// GetPrereqs returns the engine prereqs.
func (e *Identify) Prereqs() Prereqs {
	// if WithTracking is on, we need to be logged in
	return Prereqs{Device: e.arg.WithTracking}
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

	ok, uid, err := IsLoggedIn(e, ctx)
	if err != nil {
		return err
	}
	if ok {
		e.me, err = libkb.LoadMeByUID(e.G(), uid)
		if err != nil {
			return err
		}

		if e.user.Equal(e.me) {
			e.arg.WithTracking = false
			if e.arg.Source == keybase1.ClientType_KBFS {
				// if this is a self identify from kbfs, then short-circuit the identify process:
				return e.shortCircuitSelfID(ctx)
			}
		} else {
			e.arg.WithTracking = true
		}
	}

	ctx.IdentifyUI.Start(e.user.GetName(), e.arg.Reason)

	e.outcome, err = e.run(ctx)
	if err != nil {
		return err
	}

	// set the flags in the outcome with the track options to
	// inform the ui what to do with the remote tracking prompt:
	e.outcome.TrackOptions = e.arg.TrackOptions

	e.G().Log.Debug("inserting identify outcome for %q in TrackCache", e.user.GetName())
	key, err := e.G().TrackCache.Insert(e.outcome)
	if err != nil {
		return err
	}
	e.G().Log.Debug("TrackCache key: %q", key)
	e.trackToken = key

	return nil
}

func (e *Identify) User() *libkb.User {
	return e.user
}

func (e *Identify) Outcome() *libkb.IdentifyOutcome {
	return e.outcome
}

func (e *Identify) TrackToken() keybase1.TrackToken {
	return e.trackToken
}

func (e *Identify) TrackInstructions() *libkb.TrackInstructions {
	return e.trackInst
}

func (e *Identify) run(ctx *Context) (*libkb.IdentifyOutcome, error) {
	res := libkb.NewIdentifyOutcome()
	res.Username = e.user.GetName()
	is := libkb.NewIdentifyState(res, e.user)

	if e.me != nil && e.user.Equal(e.me) && !e.arg.AllowSelf {
		return nil, libkb.SelfTrackError{}
	}

	if e.arg.WithTracking {
		if e.me == nil {
			return nil, libkb.LoginRequiredError{Context: "identify with tracking"}
		}

		tlink, err := e.me.TrackChainLinkFor(e.user.GetName(), e.user.GetUID())
		if err != nil {
			return nil, err
		}
		if tlink != nil {
			is.SetTrackLookup(tlink)
			if ttcl, _ := e.me.TmpTrackChainLinkFor(e.user.GetName(), e.user.GetUID()); ttcl != nil {
				is.SetTmpTrackLookup(ttcl)
			}
		}
	}

	if !e.user.HasActiveKey() {
		return nil, libkb.NoActiveKeyError{Username: e.user.GetName()}
	}

	ctx.IdentifyUI.ReportLastTrack(libkb.ExportTrackSummary(is.TrackLookup(), e.user.GetName()))

	e.G().Log.Debug("+ Identify(%s)", e.user.GetName())

	is.Precompute(ctx.IdentifyUI.DisplayKey)

	ctx.IdentifyUI.LaunchNetworkChecks(res.ExportToUncheckedIdentity(), e.user.Export())
	waiter := e.displayUserCardAsync(ctx)

	e.user.IDTable().Identify(is, e.arg.ForceRemoteCheck, ctx.IdentifyUI, nil)
	waiter()

	base := e.user.BaseProofSet()
	res.AddProofsToSet(base, []keybase1.ProofState{keybase1.ProofState_OK})
	if !e.userExpr.MatchSet(*base) {
		return nil, fmt.Errorf("User %s didn't match given assertion", e.user.GetName())
	}

	e.G().Log.Debug("- Identify(%s)", e.user.GetName())

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
	arg := libkb.NewLoadUserArg(e.G())
	if e.arg.SelfID() {
		// loading self
		arg.Self = true
		return &arg, nil
	}

	// Use assertions for everything:
	if err := e.loadExpr(e.arg.TargetUsername); err != nil {
		return nil, err
	}

	// Next, pop off the 'best' assertion and load the user by it.
	// That is, it might be the keybase assertion (if there), or otherwise,
	// something that's unique like Twitter or Github, and lastly,
	// something like DNS that is more likely ambiguous...
	b := libkb.FindBestIdentifyComponent(e.userExpr)
	if len(b) == 0 {
		return nil, fmt.Errorf("Cannot lookup user with %q", e.arg.TargetUsername)
	}

	arg.Name = b
	arg.PublicKeyOptional = true
	return &arg, nil
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

func (e *Identify) shortCircuitSelfID(ctx *Context) error {
	e.G().Log.Debug("Identify: short-circuiting self identification")
	e.selfShortCircuit = true

	// don't really need anything but username here
	e.outcome = libkb.NewIdentifyOutcome()
	e.outcome.Username = e.user.GetName()

	return nil
}

// DidShortCircuit returns true if shortCircuitSelfID happened.
func (e *Identify) DidShortCircuit() bool {
	return e.selfShortCircuit
}

type card struct {
	Status        libkb.AppStatus `json:"status"`
	FollowSummary struct {
		Following int `json:"following"`
		Followers int `json:"followers"`
	} `json:"follow_summary"`
	Profile struct {
		FullName string `json:"full_name"`
		Location string `json:"location"`
		Bio      string `json:"bio"`
		Website  string `json:"website"`
		Twitter  string `json:"twitter"`
	} `json:"profile"`
	YouFollowThem bool `json:"you_follow_them"`
	TheyFollowYou bool `json:"they_follow_you"`
}

func (c *card) GetAppStatus() *libkb.AppStatus {
	return &c.Status
}

func getUserCard(g *libkb.GlobalContext, uid keybase1.UID, useSession bool) (ret *keybase1.UserCard, err error) {
	defer g.Trace("getUserCard", func() error { return err })()

	arg := libkb.APIArg{
		Endpoint:     "user/card",
		NeedSession:  useSession,
		Contextified: libkb.NewContextified(g),
		Args:         libkb.HTTPArgs{"uid": libkb.S{Val: uid.String()}},
	}

	var card card

	if err = g.API.GetDecode(arg, &card); err != nil {
		g.Log.Warning("error getting user/card for %s: %s\n", uid, err)
		return nil, err
	}

	g.Log.Debug("user card: %+v", card)

	ret = &keybase1.UserCard{
		Following:     card.FollowSummary.Following,
		Followers:     card.FollowSummary.Followers,
		Uid:           uid,
		FullName:      card.Profile.FullName,
		Location:      card.Profile.Location,
		Bio:           card.Profile.Bio,
		Website:       card.Profile.Website,
		Twitter:       card.Profile.Twitter,
		YouFollowThem: card.YouFollowThem,
		TheyFollowYou: card.TheyFollowYou,
	}
	return ret, nil
}

func displayUserCard(g *libkb.GlobalContext, ctx *Context, uid keybase1.UID, useSession bool) {
	card, _ := getUserCard(g, uid, useSession)
	if card != nil {
		ctx.IdentifyUI.DisplayUserCard(*card)
	}
}

func displayUserCardAsync(g *libkb.GlobalContext, ctx *Context, uid keybase1.UID, useSession bool) (waiter func()) {
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		displayUserCard(g, ctx, uid, useSession)
		wg.Done()
	}()
	return func() { wg.Wait() }
}

func (e *Identify) displayUserCardAsync(ctx *Context) (waiter func()) {
	return displayUserCardAsync(e.G(), ctx, e.user.GetUID(), (e.me != nil))
}

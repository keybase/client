// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"sync"
	"time"
)

var locktab libkb.LockTable

type identify2TestArgs struct {
	noMe     bool                  // don't load ME
	tcl      *libkb.TrackChainLink // the track chainlink to use
	selfLoad bool                  // on if this is a self load
}

//
// TODOs:
//   - think harder about what we're caching in failure cases; right now we're only
//     caching full successes.
//   - Better error typing for various failures.
//   - Work back in the identify card
//   - test caching paths
//   - better cache interface
//

// Identify2 is the Identify engine used in KBFS and as a subroutine
// of command-line crypto.
type Identify2 struct {
	libkb.Contextified

	arg        *keybase1.Identify2Arg
	testArgs   *identify2TestArgs
	trackToken keybase1.TrackToken
	cachedRes  *keybase1.UserPlusKeys
	cache      *libkb.Identify2Cache

	me   *libkb.User
	them *libkb.User

	themAssertion   libkb.AssertionExpression
	remoteAssertion libkb.AssertionAnd
	localAssertion  libkb.AssertionAnd

	state        libkb.IdentifyState
	useTracking  bool
	identifyKeys []keybase1.IdentifyKey

	ranAtTime time.Time
}

var _ (Engine) = (*Identify2)(nil)

// Name is the unique engine name.
func (e *Identify2) Name() string {
	return "Identify2"
}

func NewIdentify2(g *libkb.GlobalContext, arg *keybase1.Identify2Arg) *Identify2 {
	return &Identify2{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// GetPrereqs returns the engine prereqs.
func (e *Identify2) Prereqs() Prereqs {
	return Prereqs{}
}

// Run then engine
func (e *Identify2) Run(ctx *Context) (err error) {

	e.G().Log.Debug("+ Identify2.runSingle(UID=%v, Assertion=%s)", e.arg.Uid, e.arg.UserAssertion)

	e.G().Log.Debug("+ acquire singleflight lock")
	lock := locktab.AcquireOnName(e.arg.Uid.String())
	e.G().Log.Debug("- acquired")

	defer func() {
		if lock != nil {
			lock.Release()
		}
		e.G().Log.Debug("- Identify2.Run -> %v", err)
	}()

	if e.loadAssertion(); err != nil {
		return err
	}

	if !e.useAnyAssertions() && e.checkFastCacheHit() {
		e.G().Log.Debug("| hit fast cache")
		return nil
	}

	e.G().Log.Debug("| Identify2.loadUsers")
	if err = e.loadUsers(ctx); err != nil {
		return err
	}

	if err = e.checkLocalAssertions(); err != nil {
		return err
	}

	if e.isSelfLoad() {
		e.G().Log.Debug("| was a self load")
		return nil
	}

	if !e.useRemoteAssertions() && e.checkSlowCacheHit() {
		e.G().Log.Debug("| hit slow cache, first check")
		return nil
	}

	e.G().Log.Debug("| Identify2.createIdentifyState")
	if err = e.createIdentifyState(); err != nil {
		return err
	}

	if err = e.runIdentifyPrecomputation(); err != nil {
		return err
	}

	// First we check that all remote assertions as present for the user,
	// whether or not the remote check actually suceeds (hnece the
	// ProofState_NONE check).
	okStates := []keybase1.ProofState{keybase1.ProofState_NONE, keybase1.ProofState_OK}
	if err = e.checkRemoteAssertions(okStates); err != nil {
		e.G().Log.Debug("| Early fail due to missing remote assertions")
		return err
	}

	if e.useRemoteAssertions() && e.checkSlowCacheHit() {
		e.G().Log.Debug("| hit slow cache, second check")
		return nil
	}

	if err = e.startIdentifyUI(ctx); err != nil {
		return err
	}

	l2 := lock
	lock = nil
	if err = e.finishIdentify(ctx, l2); err != nil {
		return err
	}

	e.ranAtTime = time.Now()
	return nil
}

func (e *Identify2) runIDTableIdentify(ctx *Context, lock *libkb.NamedLock) (err error) {
	e.G().Log.Debug("+ runIDTableIdentify")
	defer func() {
		e.G().Log.Debug("- runIDTableIdentify -> %v", err)
	}()
	e.them.IDTable().Identify(e.state, false /* ForceRemoteCheck */, ctx.IdentifyUI, nil)
	e.insertTrackToken(ctx)
	err = e.checkRemoteAssertions([]keybase1.ProofState{keybase1.ProofState_OK})
	if err == nil {
		e.maybeCacheResult()
	}
	ctx.IdentifyUI.Finish()
	lock.Release()
	if err == nil {
		err = e.state.Result().GetError()
	}
	return err
}

func (e *Identify2) maybeCacheResult() {
	if e.state.Result().IsOK() && e.getCache() != nil {
		v := e.toUserPlusKeys()
		e.getCache().Insert(&v)
	}
}

func (e *Identify2) insertTrackToken(ctx *Context) (err error) {
	e.G().Log.Debug("+ insertTrackToken")
	defer func() {
		e.G().Log.Debug("- insertTrackToken -> %v", err)
	}()
	var tt keybase1.TrackToken
	tt, err = e.G().TrackCache.Insert(e.state.Result())
	if err != nil {
		return err
	}
	if err = ctx.IdentifyUI.ReportTrackToken(tt); err != nil {
		return err
	}
	return nil
}

type checkCompletedListener struct {
	libkb.Contextified
	sync.Mutex
	err       error
	ch        chan error
	needed    libkb.AssertionAnd
	received  *libkb.ProofSet
	completed bool
	responded bool
}

func newCheckCompletedListener(g *libkb.GlobalContext, ch chan error, proofs libkb.AssertionAnd) *checkCompletedListener {
	ret := &checkCompletedListener{
		Contextified: libkb.NewContextified(g),
		ch:           ch,
		needed:       proofs,
		received:     libkb.NewProofSet(nil),
	}
	return ret
}

func (c *checkCompletedListener) CheckCompleted(lcr *libkb.LinkCheckResult) {
	c.Lock()
	defer c.Unlock()

	c.G().Log.Debug("+ CheckCompleted for %s", lcr.GetLink().ToIDString())
	libkb.AddToProofSetNoChecks(lcr.GetLink(), c.received)

	if err := lcr.GetError(); err != nil {
		c.G().Log.Debug("| got error -> ", err)
		c.err = err
	}

	// note(maxtaco): this is a little ugly in that it's O(n^2) where n is the number
	// of identities in the assertion. But I can't imagine n > 3, so this is fine
	// for now.
	matched := c.needed.MatchSet(*c.received)
	c.G().Log.Debug("| matched -> %v", matched)
	if matched {
		c.completed = true
	}

	if c.err != nil || c.completed {
		c.G().Log.Debug("| maybe responding")
		c.respond()
	}
	c.G().Log.Debug("- CheckCompleted")
}

func (c *checkCompletedListener) Done() {
	c.Lock()
	defer c.Unlock()
	c.respond()
}

func (c *checkCompletedListener) respond() {
	if c.ch != nil {
		c.G().Log.Debug("| responding")
		if !c.completed && c.err == nil {
			c.G().Log.Debug("| Did not complete assertions")
			c.err = libkb.IdentifyDidNotCompleteError{}
		}
		c.ch <- c.err
		c.ch = nil
	}
}

func (e *Identify2) partiallyAsyncIdentify(ctx *Context, ch chan error, lock *libkb.NamedLock) {
	e.G().Log.Debug("+ partiallyAsyncIdentify")
	ccl := newCheckCompletedListener(e.G(), ch, e.remoteAssertion)
	e.them.IDTable().Identify(e.state, false /* ForceRemoteCheck */, ctx.IdentifyUI, ccl)
	e.insertTrackToken(ctx)
	e.maybeCacheResult()
	ctx.IdentifyUI.Finish()
	lock.Release()
	e.G().Log.Debug("- partiallyAsyncIdentify")
}

func (e *Identify2) checkLocalAssertions() error {
	if !e.localAssertion.MatchSet(*e.them.BaseProofSet()) {
		return libkb.UnmetAssertionError{User: e.them.GetName(), Remote: false}
	}
	return nil
}

func (e *Identify2) checkRemoteAssertions(okStates []keybase1.ProofState) error {
	ps := libkb.NewProofSet(nil)
	e.state.Result().AddProofsToSet(ps, okStates)
	if !e.remoteAssertion.MatchSet(*ps) {
		return libkb.UnmetAssertionError{User: e.them.GetName(), Remote: true}
	}
	return nil
}

func (e *Identify2) finishIdentify(ctx *Context, lock *libkb.NamedLock) (err error) {

	e.G().Log.Debug("+ finishIdentify")
	defer func() {
		e.G().Log.Debug("- finishIdentify -> %v", err)
	}()

	ctx.IdentifyUI.LaunchNetworkChecks(e.state.ExportToUncheckedIdentity(), e.them.Export())

	switch {
	case e.useTracking:
		e.G().Log.Debug("| Case 1: Using Tracking")
		err = e.runIDTableIdentify(ctx, lock)
	case !e.useRemoteAssertions():
		e.G().Log.Debug("| Case 2: No tracking, without remote assertions")
		go e.runIDTableIdentify(ctx, lock)
	default:
		e.G().Log.Debug("| Case 3: No tracking, with remote assertions")
		ch := make(chan error)
		go e.partiallyAsyncIdentify(ctx, ch, lock)
		err = <-ch
	}

	return err
}

func (e *Identify2) loadAssertion() (err error) {
	e.themAssertion, err = libkb.AssertionParseAndOnly(e.arg.UserAssertion)
	if err == nil {
		e.remoteAssertion, e.localAssertion = libkb.CollectAssertions(e.themAssertion)
	}
	return err
}

func (e *Identify2) useAnyAssertions() bool {
	return e.useLocalAssertions() || e.useRemoteAssertions()
}

func (e *Identify2) useLocalAssertions() bool {
	return e.localAssertion.Len() > 0
}
func (e *Identify2) useRemoteAssertions() bool {
	return e.remoteAssertion.Len() > 0
}

func (e *Identify2) getIdentifyTime() keybase1.Time {
	return keybase1.Time(e.ranAtTime.Unix())
}

func (e *Identify2) runIdentifyPrecomputation() (err error) {
	f := func(k keybase1.IdentifyKey) {
		e.identifyKeys = append(e.identifyKeys, k)
	}
	e.state.Precompute(f)
	return nil
}

func (e *Identify2) startIdentifyUI(ctx *Context) (err error) {
	e.G().Log.Debug("+ Identify(%s)", e.them.GetName())
	ctx.IdentifyUI.Start(e.them.GetName())
	for _, k := range e.identifyKeys {
		ctx.IdentifyUI.DisplayKey(k)
	}
	ctx.IdentifyUI.ReportLastTrack(libkb.ExportTrackSummary(e.state.TrackLookup(), e.them.GetName()))
	return nil
}

func (e *Identify2) getTrackChainLink() (*libkb.TrackChainLink, error) {
	if e.testArgs != nil && e.testArgs.tcl != nil {
		return e.testArgs.tcl, nil
	}
	if e.me == nil {
		return nil, nil
	}
	return e.me.TrackChainLinkFor(e.them.GetName(), e.them.GetUID())
}

func (e *Identify2) createIdentifyState() (err error) {
	e.state = libkb.NewIdentifyState(nil, e.them)

	tcl, err := e.getTrackChainLink()
	if err != nil {
		return err
	}
	if tcl != nil {
		e.useTracking = true
		e.state.SetTrackLookup(tcl)
	}

	return nil
}

// RequiredUIs returns the required UIs.
func (e *Identify2) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.IdentifyUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Identify2) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *Identify2) isSelfLoad() bool {
	if e.testArgs != nil && e.testArgs.selfLoad {
		return true
	}
	return e.me != nil && e.them != nil && e.me.Equal(e.them)
}

func (e *Identify2) loadMe(ctx *Context) (err error) {

	// Short circuit loadMe for testing
	if e.testArgs != nil && e.testArgs.noMe {
		return nil
	}

	var ok bool
	ok, err = IsLoggedIn(e, ctx)
	if err != nil || !ok {
		return err
	}
	e.me, err = libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	return err
}

func (e *Identify2) loadThem(ctx *Context) (err error) {
	arg := libkb.NewLoadUserArg(e.G())
	arg.UID = e.arg.Uid
	e.them, err = libkb.LoadUser(arg)
	if e.them == nil {
		return libkb.UserNotFoundError{UID: arg.UID, Msg: "in identify2"}
	}
	return err
}

func (e *Identify2) loadUsers(ctx *Context) (err error) {
	if err = e.loadMe(ctx); err != nil {
		return err
	}
	if err = e.loadThem(ctx); err != nil {
		return err
	}
	return nil
}

func (e *Identify2) checkFastCacheHit() bool {
	if e.getCache() == nil {
		return false
	}
	fn := func(u keybase1.UserPlusKeys) keybase1.Time { return u.Uvv.CachedAt }
	u, _ := e.getCache().Get(e.arg.Uid, fn, libkb.Identify2CacheShortTimeout)
	if u == nil {
		return false
	}
	e.cachedRes = u
	return true
}

func (e *Identify2) checkSlowCacheHit() bool {
	if e.getCache() == nil {
		return false
	}

	fn := func(u keybase1.UserPlusKeys) keybase1.Time { return u.Uvv.LastIdentifiedAt }
	u, _ := e.getCache().Get(e.them.GetUID(), fn, libkb.Identify2CacheLongTimeout)
	if u == nil {
		return false
	}
	if !e.them.IsCachedIdentifyFresh(u) {
		return false
	}
	e.cachedRes = u
	return true
}

func (e *Identify2) Result() *keybase1.Identify2Res {
	res := &keybase1.Identify2Res{}
	if e.cachedRes != nil {
		res.Upk = *e.cachedRes
	} else if e.them != nil {
		res.Upk = e.toUserPlusKeys()
	}
	return res
}

func (e *Identify2) toUserPlusKeys() keybase1.UserPlusKeys {
	return e.them.ExportToUserPlusKeys(e.getIdentifyTime())
}

func (e *Identify2) getCache() libkb.Identify2Cacher {
	if e.cache != nil {
		return e.cache
	}
	return e.G().Identify2Cache
}

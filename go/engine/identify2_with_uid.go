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

type Identify2WithUIDTestArgs struct {
	noMe     bool                  // don't load ME
	tcl      *libkb.TrackChainLink // the track chainlink to use
	selfLoad bool                  // on if this is a self load
	cache    libkb.Identify2Cacher
	clock    func() time.Time
}

//
// TODOs:
//   - think harder about what we're caching in failure cases; right now we're only
//     caching full successes.
//   - Better error typing for various failures.
//   - Work back in the identify card
//

// Identify2WithUID is the Identify engine used in KBFS and as a subroutine
// of command-line crypto.
type Identify2WithUID struct {
	libkb.Contextified

	arg        *keybase1.Identify2WithUIDArg
	testArgs   *Identify2WithUIDTestArgs
	trackToken keybase1.TrackToken
	cachedRes  *keybase1.UserPlusKeys

	me   *libkb.User
	them *libkb.User

	themAssertion   libkb.AssertionExpression
	remoteAssertion libkb.AssertionAnd
	localAssertion  libkb.AssertionAnd

	state        libkb.IdentifyState
	useTracking  bool
	identifyKeys []keybase1.IdentifyKey

	resultCh chan<- error

	// For eagerly checking remote Assertions as they come in, these
	// member variables maintain state, protected by the remotesMutex.
	remotesMutex     sync.Mutex
	remotesReceived  *libkb.ProofSet
	remotesError     error
	remotesCompleted bool
}

var _ (Engine) = (*Identify2WithUID)(nil)
var _ (libkb.CheckCompletedListener) = (*Identify2WithUID)(nil)

// Name is the unique engine name.
func (e *Identify2WithUID) Name() string {
	return "Identify2WithUID"
}

func NewIdentify2WithUID(g *libkb.GlobalContext, arg *keybase1.Identify2WithUIDArg) *Identify2WithUID {
	return &Identify2WithUID{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// GetPrereqs returns the engine prereqs.
func (e *Identify2WithUID) Prereqs() Prereqs {
	return Prereqs{}
}

// Run then engine
func (e *Identify2WithUID) Run(ctx *Context) (err error) {

	e.G().Log.Debug("+ Identify2WithUID.Run(UID=%v, Assertion=%s)", e.arg.Uid, e.arg.UserAssertion)

	// Only the first send matters, but we don't want to block the subsequent no-op
	// sends. This code will break when we have more than 100 unblocking opportunities.
	ch := make(chan error, 100)

	e.resultCh = ch
	go e.run(ctx)
	err = <-ch
	e.G().Log.Debug("- Identify2WithUID.Run() -> %v", err)
	return err
}

func (e *Identify2WithUID) run(ctx *Context) {
	err := e.runReturnError(ctx)
	e.unblock(err)
}

func (e *Identify2WithUID) runReturnError(ctx *Context) (err error) {

	e.G().Log.Debug("+ acquire singleflight lock")
	lock := locktab.AcquireOnName(e.arg.Uid.String())
	e.G().Log.Debug("- acquired")

	defer lock.Release()

	if e.loadAssertion(); err != nil {
		return err
	}

	if !e.useAnyAssertions() && e.checkFastCacheHit() {
		e.G().Log.Debug("| hit fast cache")
		return nil
	}

	e.G().Log.Debug("| Identify2WithUID.loadUsers")
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

	e.G().Log.Debug("| Identify2WithUID.createIdentifyState")
	if err = e.createIdentifyState(); err != nil {
		return err
	}

	if err = e.runIdentifyPrecomputation(); err != nil {
		return err
	}

	// First we check that all remote assertions as present for the user,
	// whether or not the remote check actually suceeds (hence the
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

	// If we're not using tracking and we're not using remote assertions,
	// we can unblock the RPC caller here, and perform the identifyUI operations
	// in the background.
	if !e.useTracking && !e.useRemoteAssertions() {
		e.unblock(nil)
	}

	if err = e.runIdentifyUI(ctx); err != nil {
		return err
	}

	return nil
}

func (e *Identify2WithUID) getNow() time.Time {
	if e.testArgs != nil && e.testArgs.clock != nil {
		return e.testArgs.clock()
	}
	return time.Now()
}

func (e *Identify2WithUID) unblock(err error) {
	e.G().Log.Debug("| unblocking...")
	e.resultCh <- err
}

func (e *Identify2WithUID) maybeCacheResult() {
	if e.state.Result().IsOK() && e.getCache() != nil {
		v := e.toUserPlusKeys()
		e.getCache().Insert(&v)
	}
}

func (e *Identify2WithUID) insertTrackToken(ctx *Context) (err error) {
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

// CCLCheckCompleted is triggered whenever a remote proof check completes.
// We get these calls as a result of being a "CheckCompletedListener".
// When each result comes in, we check against our pool of needed remote
// assertions. If the set is complete, or if one that we need errors,
// we can unblock the caller.
func (e *Identify2WithUID) CCLCheckCompleted(lcr *libkb.LinkCheckResult) {
	e.remotesMutex.Lock()
	defer e.remotesMutex.Unlock()

	e.G().Log.Debug("+ CheckCompleted for %s", lcr.GetLink().ToIDString())
	defer e.G().Log.Debug("- CheckCompleted")

	if !e.useRemoteAssertions() || e.useTracking {
		e.G().Log.Debug("| Early out, since not using remote assertions or is tracking")
		return
	}

	pf := libkb.RemoteProofChainLinkToProof(lcr.GetLink())
	e.remotesReceived.Add(pf)

	if !e.remoteAssertion.HasFactor(pf) {
		e.G().Log.Debug("| Proof isn't needed in our remote-assertion early-out check: %v", pf)
		return
	}

	if err := lcr.GetError(); err != nil {
		e.G().Log.Debug("| got error -> %v", err)
		e.remotesError = err
	}

	// note(maxtaco): this is a little ugly in that it's O(n^2) where n is the number
	// of identities in the assertion. But I can't imagine n > 3, so this is fine
	// for now.
	matched := e.remoteAssertion.MatchSet(*e.remotesReceived)
	e.G().Log.Debug("| matched -> %v", matched)
	if matched {
		e.remotesCompleted = true
	}

	if e.remotesError != nil || e.remotesCompleted {
		e.G().Log.Debug("| unblocking, with err = %v", e.remotesError)
		e.unblock(e.remotesError)
	}
}

func (e *Identify2WithUID) checkLocalAssertions() error {
	if !e.localAssertion.MatchSet(*e.them.BaseProofSet()) {
		return libkb.UnmetAssertionError{User: e.them.GetName(), Remote: false}
	}
	return nil
}

func (e *Identify2WithUID) checkRemoteAssertions(okStates []keybase1.ProofState) error {
	ps := libkb.NewProofSet(nil)
	e.state.Result().AddProofsToSet(ps, okStates)
	if !e.remoteAssertion.MatchSet(*ps) {
		return libkb.UnmetAssertionError{User: e.them.GetName(), Remote: true}
	}
	return nil
}

func (e *Identify2WithUID) loadAssertion() (err error) {
	e.themAssertion, err = libkb.AssertionParseAndOnly(e.arg.UserAssertion)
	if err == nil {
		e.remoteAssertion, e.localAssertion = libkb.CollectAssertions(e.themAssertion)
	}
	return err
}

func (e *Identify2WithUID) useAnyAssertions() bool {
	return e.useLocalAssertions() || e.useRemoteAssertions()
}

func (e *Identify2WithUID) useLocalAssertions() bool {
	return e.localAssertion.Len() > 0
}
func (e *Identify2WithUID) useRemoteAssertions() bool {
	return e.remoteAssertion.Len() > 0
}

func (e *Identify2WithUID) runIdentifyPrecomputation() (err error) {
	f := func(k keybase1.IdentifyKey) {
		e.identifyKeys = append(e.identifyKeys, k)
	}
	e.state.Precompute(f)
	return nil
}

func (e *Identify2WithUID) runIdentifyUI(ctx *Context) (err error) {
	e.G().Log.Debug("+ runIdentifyUI(%s)", e.them.GetName())
	e.remotesReceived = libkb.NewProofSet(nil)

	ctx.IdentifyUI.Start(e.them.GetName())
	for _, k := range e.identifyKeys {
		ctx.IdentifyUI.DisplayKey(k)
	}
	ctx.IdentifyUI.ReportLastTrack(libkb.ExportTrackSummary(e.state.TrackLookup(), e.them.GetName()))
	ctx.IdentifyUI.LaunchNetworkChecks(e.state.ExportToUncheckedIdentity(), e.them.Export())
	e.them.IDTable().Identify(e.state, false /* ForceRemoteCheck */, ctx.IdentifyUI, e)
	ctx.IdentifyUI.Finish()

	err = e.checkRemoteAssertions([]keybase1.ProofState{keybase1.ProofState_OK})
	e.insertTrackToken(ctx)
	e.maybeCacheResult()

	if err == nil {
		err = e.state.Result().GetError()
	}

	e.G().Log.Debug("- runIdentifyUI(%s) -> %v", e.them.GetName(), err)
	return err
}

func (e *Identify2WithUID) getTrackChainLink() (*libkb.TrackChainLink, error) {
	if e.testArgs != nil && e.testArgs.tcl != nil {
		return e.testArgs.tcl, nil
	}
	if e.me == nil {
		return nil, nil
	}
	return e.me.TrackChainLinkFor(e.them.GetName(), e.them.GetUID())
}

func (e *Identify2WithUID) createIdentifyState() (err error) {
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
func (e *Identify2WithUID) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.IdentifyUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Identify2WithUID) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *Identify2WithUID) isSelfLoad() bool {
	if e.testArgs != nil && e.testArgs.selfLoad {
		return true
	}
	return e.me != nil && e.them != nil && e.me.Equal(e.them)
}

func (e *Identify2WithUID) loadMe(ctx *Context) (err error) {

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

func (e *Identify2WithUID) loadThem(ctx *Context) (err error) {
	arg := libkb.NewLoadUserArg(e.G())
	arg.UID = e.arg.Uid
	e.them, err = libkb.LoadUser(arg)
	if e.them == nil {
		return libkb.UserNotFoundError{UID: arg.UID, Msg: "in Identify2WithUID"}
	}
	return err
}

func (e *Identify2WithUID) loadUsers(ctx *Context) (err error) {
	if err = e.loadMe(ctx); err != nil {
		return err
	}
	if err = e.loadThem(ctx); err != nil {
		return err
	}
	return nil
}

func (e *Identify2WithUID) checkFastCacheHit() bool {
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

func (e *Identify2WithUID) checkSlowCacheHit() bool {
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

func (e *Identify2WithUID) Result() *keybase1.Identify2Res {
	res := &keybase1.Identify2Res{}
	if e.cachedRes != nil {
		res.Upk = *e.cachedRes
	} else if e.them != nil {
		res.Upk = e.toUserPlusKeys()
	}
	return res
}

func (e *Identify2WithUID) toUserPlusKeys() keybase1.UserPlusKeys {
	return e.them.ExportToUserPlusKeys(keybase1.ToTime(e.getNow()))
}

func (e *Identify2WithUID) getCache() libkb.Identify2Cacher {
	if e.testArgs != nil && e.testArgs.cache != nil {
		return e.testArgs.cache
	}
	return e.G().Identify2Cache
}

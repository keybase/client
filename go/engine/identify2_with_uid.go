// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"sync"
	"time"

	gregor "github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

var locktab libkb.LockTable

type Identify2WithUIDTestArgs struct {
	noMe     bool                  // don't load ME
	tcl      *libkb.TrackChainLink // the track chainlink to use
	selfLoad bool                  // on if this is a self load
	noCache  bool                  // on if we shouldn't use the cache
	cache    libkb.Identify2Cacher
	clock    func() time.Time
}

type identify2TrackType int

const (
	identify2NoTrack identify2TrackType = iota
	identify2TrackOK
	identify2TrackBroke
)

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

	arg           *keybase1.Identify2Arg
	testArgs      *Identify2WithUIDTestArgs
	trackToken    keybase1.TrackToken
	confirmResult keybase1.ConfirmResult
	cachedRes     *keybase1.UserPlusKeys

	// If we just resolved a user, then we can plumb this through to loadUser()
	ResolveBody *jsonw.Wrapper

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

	responsibleGregorItem gregor.Item

	// When tracking is being performed, the identify engine is used with a tracking ui.
	// These options are sent to the ui based on command line options.
	// For normal identify, safe to leave these in their default zero state.
	trackOptions keybase1.TrackOptions

	// When called from chat, we should just collect breaking tracking failures, but
	// not fail track. This is where we collect them
	trackBreaks *keybase1.IdentifyTrackBreaks
}

var _ (Engine) = (*Identify2WithUID)(nil)
var _ (libkb.CheckCompletedListener) = (*Identify2WithUID)(nil)

// Name is the unique engine name.
func (e *Identify2WithUID) Name() string {
	return "Identify2WithUID"
}

func NewIdentify2WithUID(g *libkb.GlobalContext, arg *keybase1.Identify2Arg) *Identify2WithUID {
	return &Identify2WithUID{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// GetPrereqs returns the engine prereqs.
func (e *Identify2WithUID) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *Identify2WithUID) WantDelegate(k libkb.UIKind) bool {
	return k == libkb.IdentifyUIKind && e.arg.UseDelegateUI
}

func (e *Identify2WithUID) calledFromChatGUI() bool {
	return e.arg.ChatGUIMode
}

func (e *Identify2WithUID) resetError(err error) error {

	if err == nil {
		return nil
	}

	switch err.(type) {
	case libkb.ProofError:
	case libkb.IdentifySummaryError:
	default:
		return err
	}

	if e.calledFromChatGUI() {
		e.G().Log.Debug("| Reset err from %v -> nil since caller is 'CHAT_GUI'", err)
		return nil
	}

	return err
}

// Run then engine
func (e *Identify2WithUID) Run(ctx *Context) (err error) {
	defer libkb.TimeLog(fmt.Sprintf("Identify2WithUID.Run(UID=%v, Assertion=%s", e.arg.Uid, e.arg.UserAssertion), e.G().Clock().Now(), e.G().Log.Debug)
	e.G().Log.Debug("+ Identify2WithUID.Run(UID=%v, Assertion=%s)", e.arg.Uid, e.arg.UserAssertion)
	e.G().Log.Debug("| Full Arg: %+v", e.arg)

	if e.arg.Uid.IsNil() {
		return libkb.NoUIDError{}
	}

	// Only the first send matters, but we don't want to block the subsequent no-op
	// sends. This code will break when we have more than 100 unblocking opportunities.
	ch := make(chan error, 100)

	e.resultCh = ch
	go e.run(ctx)
	err = <-ch

	// Potentially reset the error based on the error and the calling context.
	err = e.resetError(err)

	e.G().Log.Debug("- Identify2WithUID.Run() -> %v", err)

	return err
}

func (e *Identify2WithUID) run(ctx *Context) {
	err := e.runReturnError(ctx)
	e.unblock( /* isFinal */ true, err)
	ctx.IdentifyUI.Cancel() // always cancel IdentifyUI to allow clients to clean up
}

func (e *Identify2WithUID) hitFastCache() bool {
	if e.useAnyAssertions() {
		e.G().Log.Debug("| missed fast cache: has assertions")
		return false
	}
	if !e.allowEarlyOuts() {
		e.G().Log.Debug("| missed fast cache: we don't allow early outs")
		return false
	}
	if !e.checkFastCacheHit() {
		e.G().Log.Debug("| missed fast cache: didn't hit")
		return false
	}
	return true
}

func (e *Identify2WithUID) runReturnError(ctx *Context) (err error) {

	e.G().Log.Debug("+ acquire singleflight lock for %s", e.arg.Uid)
	lock := locktab.AcquireOnName(e.arg.Uid.String())
	e.G().Log.Debug("- acquired singleflight lock")

	defer func() {
		e.G().Log.Debug("+ Releasing singleflight lock for %s", e.arg.Uid)
		lock.Release()
		e.G().Log.Debug("- Released singleflight lock")
	}()

	if err = e.loadAssertion(); err != nil {
		return err
	}

	if e.hitFastCache() {
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

	if e.isSelfLoad() && !e.arg.NoSkipSelf {
		e.G().Log.Debug("| was a self load, short-circuiting")
		e.maybeCacheSelf()
		return nil
	}

	if !e.useRemoteAssertions() && e.allowEarlyOuts() && e.checkSlowCacheHit() {
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

	if e.useRemoteAssertions() && e.allowEarlyOuts() && e.checkSlowCacheHit() {
		e.G().Log.Debug("| hit slow cache, second check")
		return nil
	}

	// If we're not using tracking and we're not using remote assertions,
	// we can unblock the RPC caller here, and perform the identifyUI operations
	// in the background.
	if !e.useTracking && !e.useRemoteAssertions() && e.allowEarlyOuts() {
		e.unblock( /* isFinal */ false, nil)
	}

	if err = e.runIdentifyUI(ctx); err != nil {
		return err
	}
	return nil
}

func (e *Identify2WithUID) allowEarlyOuts() bool {
	return !e.arg.NeedProofSet
}

func (e *Identify2WithUID) getNow() time.Time {
	if e.testArgs != nil && e.testArgs.clock != nil {
		return e.testArgs.clock()
	}
	return time.Now()
}

func (e *Identify2WithUID) unblock(isFinal bool, err error) {
	e.G().Log.Debug("| unblocking...")
	if e.arg.AlwaysBlock && !isFinal {
		e.G().Log.Debug("| skipping unblock; isFinal=%v; AlwaysBlock=%v...", isFinal, e.arg.AlwaysBlock)
	} else {
		e.resultCh <- err
		e.G().Log.Debug("| unblock sent...")
	}
}

func (e *Identify2WithUID) maybeCacheSelf() {
	if e.getCache() != nil {
		v := e.toUserPlusKeys()
		e.getCache().Insert(&v)
	}
}

func (e *Identify2WithUID) maybeCacheResult() {
	e.G().Log.Debug("+ maybeCacheResult")
	if e.state.Result().IsOK() && e.getCache() != nil {
		v := e.toUserPlusKeys()
		e.getCache().Insert(&v)
		e.G().Log.Debug("| insert %+v", v)
	}
	e.G().Log.Debug("- maybeCacheResult")
}

func (e *Identify2WithUID) insertTrackToken(ctx *Context, outcome *libkb.IdentifyOutcome, ui libkb.IdentifyUI) (err error) {
	e.G().Log.Debug("+ insertTrackToken")
	defer func() {
		e.G().Log.Debug("- insertTrackToken -> %v", err)
	}()
	e.trackToken, err = e.G().TrackCache.Insert(outcome)
	if err != nil {
		return err
	}
	if err = ui.ReportTrackToken(e.trackToken); err != nil {
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

	// Always add to remotesReceived list, so that we have a full ProofSet.
	pf := libkb.RemoteProofChainLinkToProof(lcr.GetLink())
	e.remotesReceived.Add(pf)

	if !e.useRemoteAssertions() || e.useTracking {
		e.G().Log.Debug("| Not using remote assertions or is tracking")
		return
	}

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
		e.unblock(false, e.remotesError)
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
	if len(e.arg.UserAssertion) == 0 {
		return nil
	}
	e.themAssertion, err = libkb.AssertionParseAndOnly(e.G().MakeAssertionContext(), e.arg.UserAssertion)
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

// If we need a ProofSet, it's as if we need remote assertions.
func (e *Identify2WithUID) useRemoteAssertions() bool {
	return (e.remoteAssertion.Len() > 0)
}

func (e *Identify2WithUID) runIdentifyPrecomputation() (err error) {
	f := func(k keybase1.IdentifyKey) error {
		e.identifyKeys = append(e.identifyKeys, k)
		return nil
	}
	e.state.Precompute(f)
	return nil
}

func (e *Identify2WithUID) displayUserCardAsync(iui libkb.IdentifyUI) <-chan error {
	if e.calledFromChatGUI() {
		return nil
	}
	return displayUserCardAsync(e.G(), iui, e.them.GetUID(), (e.me != nil))
}

func (e *Identify2WithUID) runIdentifyUI(ctx *Context) (err error) {
	e.G().Log.Debug("+ runIdentifyUI(%s)", e.them.GetName())
	defer e.G().Log.Debug("- runIdentifyUI(%s) -> %s", e.them.GetName(), libkb.ErrToOk(err))

	// RemoteReceived, start with the baseProofSet that has PGP
	// fingerprints and the user's UID and username.
	e.remotesReceived = e.them.BaseProofSet()

	iui := ctx.IdentifyUI
	if e.useTracking && e.arg.CanSuppressUI && !e.arg.ForceDisplay {
		iui = newBufferedIdentifyUI(e.G(), iui, keybase1.ConfirmResult{
			IdentityConfirmed: true,
		})
	} else if e.calledFromChatGUI() {
		iui = newLoopbackIdentifyUI(e.G(), &e.trackBreaks)
	}

	e.G().Log.Debug("| IdentifyUI.Start(%s)", e.them.GetName())
	if err = iui.Start(e.them.GetName(), e.arg.Reason, e.arg.ForceDisplay); err != nil {
		return err
	}
	for _, k := range e.identifyKeys {
		if err = iui.DisplayKey(k); err != nil {
			return err
		}
	}
	e.G().Log.Debug("| IdentifyUI.ReportLastTrack(%s)", e.them.GetName())
	if err = iui.ReportLastTrack(libkb.ExportTrackSummary(e.state.TrackLookup(), e.them.GetName())); err != nil {
		return err
	}
	e.G().Log.Debug("| IdentifyUI.LaunchNetworkChecks(%s)", e.them.GetName())
	if err = iui.LaunchNetworkChecks(e.state.ExportToUncheckedIdentity(), e.them.Export()); err != nil {
		return err
	}

	waiter := e.displayUserCardAsync(iui)

	e.G().Log.Debug("| IdentifyUI.Identify(%s)", e.them.GetName())
	if err = e.them.IDTable().Identify(e.state, e.arg.ForceRemoteCheck, iui, e); err != nil {
		e.G().Log.Debug("| Failure in running IDTable")
		return err
	}

	if waiter != nil {
		e.G().Log.Debug("+ Waiting for UserCard")
		if err = <-waiter; err != nil {
			e.G().Log.Debug("| Failure in showing UserCard")
			return err
		}
		e.G().Log.Debug("- Waited for UserCard")
	}

	// use Confirm to display the IdentifyOutcome
	outcome := e.state.Result()
	outcome.TrackOptions = e.trackOptions
	e.confirmResult, err = iui.Confirm(outcome.Export())
	if err != nil {
		e.G().Log.Debug("| Failure in iui.Confirm")
		return err
	}

	e.insertTrackToken(ctx, outcome, iui)

	if err = iui.Finish(); err != nil {
		e.G().Log.Debug("| Failure in iui.Finish")
		return err
	}
	e.G().Log.Debug("| IdentifyUI.Finished(%s)", e.them.GetName())

	err = e.checkRemoteAssertions([]keybase1.ProofState{keybase1.ProofState_OK})
	e.maybeCacheResult()

	if err == nil && !e.arg.NoErrorOnTrackFailure {
		// We only care about tracking errors in this case; hence GetErrorLax
		_, err = e.state.Result().GetErrorLax()
	}

	e.G().Log.Debug("- runIdentifyUI(%s) -> %v", e.them.GetName(), err)
	return err
}

func (e *Identify2WithUID) getTrackChainLink(tmp bool) (*libkb.TrackChainLink, error) {
	if e.testArgs != nil && e.testArgs.tcl != nil {
		return e.testArgs.tcl, nil
	}
	if e.me == nil {
		return nil, nil
	}
	if tmp {
		return e.me.TmpTrackChainLinkFor(e.them.GetName(), e.them.GetUID())
	}
	return e.me.TrackChainLinkFor(e.them.GetName(), e.them.GetUID())
}

func (e *Identify2WithUID) createIdentifyState() (err error) {
	e.state = libkb.NewIdentifyStateWithGregorItem(e.responsibleGregorItem, e.them)
	tcl, err := e.getTrackChainLink(false)
	if err != nil {
		return err
	}
	if tcl != nil {
		e.useTracking = true
		e.state.SetTrackLookup(tcl)
		if ttcl, _ := e.getTrackChainLink(true); ttcl != nil {
			e.state.SetTmpTrackLookup(ttcl)
		}
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
	var uid keybase1.UID
	ok, uid, err = IsLoggedIn(e, ctx)
	if err != nil || !ok {
		return err
	}
	e.me, err = libkb.LoadMeByUID(e.G(), uid)
	return err
}

func (e *Identify2WithUID) loadThem(ctx *Context) (err error) {
	arg := libkb.NewLoadUserArg(e.G())
	arg.UID = e.arg.Uid
	arg.ResolveBody = e.ResolveBody
	e.them, err = libkb.LoadUser(arg)
	if err != nil {
		switch err.(type) {
		case libkb.NoKeyError:
			// convert this error to NoSigChainError
			return libkb.NoSigChainError{}
		case libkb.NotFoundError:
			return libkb.UserNotFoundError{UID: arg.UID, Msg: "in Identify2WithUID"}
		default: // including libkb.DeletedError
			return err
		}
	}
	if e.them == nil {
		return libkb.UserNotFoundError{UID: arg.UID, Msg: "in Identify2WithUID"}
	}
	return nil
}

func (e *Identify2WithUID) loadUsers(ctx *Context) error {
	var loadMeErr, loadThemErr error
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		loadMeErr = e.loadMe(ctx)
		wg.Done()
	}()
	wg.Add(1)
	go func() {
		loadThemErr = e.loadThem(ctx)
		wg.Done()
	}()
	wg.Wait()

	if loadMeErr != nil {
		return loadMeErr
	}
	if loadThemErr != nil {
		return loadThemErr
	}

	return nil
}

func (e *Identify2WithUID) checkFastCacheHit() bool {
	if e.getCache() == nil {
		return false
	}
	fn := func(u keybase1.UserPlusKeys) keybase1.Time { return u.Uvv.CachedAt }
	u, err := e.getCache().Get(e.arg.Uid, fn, libkb.Identify2CacheShortTimeout)
	if err != nil {
		e.G().Log.Debug("fast cache error for %s: %s", e.arg.Uid, err)
	}
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

	// Update so that it hits the fast cache the next time
	u.Uvv.CachedAt = keybase1.ToTime(time.Now())
	return true
}

func (e *Identify2WithUID) Result() *keybase1.Identify2Res {
	res := &keybase1.Identify2Res{}
	if e.cachedRes != nil {
		res.Upk = *e.cachedRes
	} else if e.them != nil {
		res.Upk = e.toUserPlusKeys()
	}

	// This will be a no-op unless we're being called from the chat GUI
	res.TrackBreaks = e.trackBreaks

	return res
}

func (e *Identify2WithUID) GetProofSet() *libkb.ProofSet {
	return e.remotesReceived
}

func (e *Identify2WithUID) toUserPlusKeys() keybase1.UserPlusKeys {
	return e.them.ExportToUserPlusKeys(keybase1.ToTime(e.getNow()))
}

func (e *Identify2WithUID) getCache() libkb.Identify2Cacher {
	if e.testArgs != nil && e.testArgs.cache != nil {
		return e.testArgs.cache
	}
	if e.testArgs != nil && e.testArgs.noCache {
		return nil
	}
	return e.G().Identify2Cache
}

func (e *Identify2WithUID) getTrackType() identify2TrackType {
	switch {
	case !e.useTracking || e.state.Result() == nil:
		return identify2NoTrack
	case e.state.Result().IsOK():
		return identify2TrackOK
	default:
		return identify2TrackBroke
	}
}

func (e *Identify2WithUID) SetResponsibleGregorItem(item gregor.Item) {
	e.responsibleGregorItem = item
}

func (e *Identify2WithUID) TrackToken() keybase1.TrackToken {
	return e.trackToken
}

func (e *Identify2WithUID) ConfirmResult() keybase1.ConfirmResult {
	return e.confirmResult
}

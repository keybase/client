// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"sync"
	"time"

	gregor "github.com/keybase/client/go/gregor"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	context "golang.org/x/net/context"
)

var locktab libkb.LockTable

type Identify2TestStats struct {
	untrackedFastPaths int
}

type Identify2WithUIDTestArgs struct {
	noMe                   bool                  // don't load ME
	tcl                    *libkb.TrackChainLink // the track chainlink to use
	selfLoad               bool                  // on if this is a self load
	noCache                bool                  // on if we shouldn't use the cache
	cache                  libkb.Identify2Cacher
	clock                  func() time.Time
	forceRemoteCheck       bool // on if we should force remote checks (like busting caches)
	allowUntrackedFastPath bool // on if we can allow untracked fast path in test
	stats                  Identify2TestStats
}

type identify2TrackType int

const (
	identify2NoTrack identify2TrackType = iota
	identify2TrackOK
	identify2TrackBroke
)

type identifyUser struct {
	arg  libkb.LoadUserArg
	full *libkb.User
	thin *keybase1.UserPlusAllKeys
}

func (i *identifyUser) GetUID() keybase1.UID {
	if i.thin != nil {
		return i.thin.GetUID()
	}
	if i.full != nil {
		return i.full.GetUID()
	}
	panic("null user")
}

func (i *identifyUser) GetName() string {
	if i.thin != nil {
		return i.thin.GetName()
	}
	if i.full != nil {
		return i.full.GetName()
	}
	panic("null user")
}

func (i *identifyUser) GetNormalizedName() libkb.NormalizedUsername {
	return libkb.NewNormalizedUsername(i.GetName())
}

func (i *identifyUser) BaseProofSet() *libkb.ProofSet {
	if i.thin != nil {
		return libkb.BaseProofSet(i.thin)
	}
	if i.full != nil {
		return i.full.BaseProofSet()
	}
	panic("null user")
}

func (i *identifyUser) User(cache libkb.Identify2Cacher) (*libkb.User, error) {
	if i.full != nil {
		return i.full, nil
	}
	if cache != nil {
		cache.DidFullUserLoad(i.GetUID())
	}
	var err error
	i.full, err = libkb.LoadUser(i.arg)
	return i.full, err
}

func (i *identifyUser) Export() *keybase1.User {
	if i.thin != nil {
		return i.thin.Export()
	}
	if i.full != nil {
		return i.full.Export()
	}
	panic("null user")
}

func (i *identifyUser) ExportToUserPlusKeys(now keybase1.Time) keybase1.UserPlusKeys {
	if i.thin != nil {
		ret := i.thin.Base
		ret.Uvv.LastIdentifiedAt = now
		return ret
	}
	if i.full != nil {
		return i.full.ExportToUserPlusKeys(now)
	}
	panic("null user")
}

func (i *identifyUser) IsCachedIdentifyFresh(upk *keybase1.UserPlusKeys) bool {
	if i.thin != nil {
		ret := i.thin.Base.Uvv.Equal(upk.Uvv)
		return ret
	}
	if i.full != nil {
		return i.full.IsCachedIdentifyFresh(upk)
	}
	panic("null user")
}

func (i *identifyUser) Equal(i2 *identifyUser) bool {
	return i.GetUID().Equal(i2.GetUID())
}

func (i *identifyUser) load(g *libkb.GlobalContext) (err error) {
	i.thin, i.full, err = g.GetUPAKLoader().Load(i.arg)
	return err
}

func (i *identifyUser) forceFullLoad(g *libkb.GlobalContext) (err error) {
	arg := i.arg
	arg.ForceReload = true
	i.thin, i.full, err = g.GetUPAKLoader().Load(arg)
	return err
}

func (i *identifyUser) isNil() bool {
	return i.thin == nil && i.full == nil
}

func loadIdentifyUser(ctx *Context, g *libkb.GlobalContext, arg libkb.LoadUserArg, cache libkb.Identify2Cacher) (*identifyUser, error) {
	arg.SetGlobalContext(g)
	arg.NetContext = ctx.GetNetContext()
	ret := &identifyUser{arg: arg}
	err := ret.load(g)
	if ret.isNil() {
		ret = nil
	} else if ret.full != nil && cache != nil {
		cache.DidFullUserLoad(ret.GetUID())
	}
	return ret, err
}

func (i *identifyUser) trackChainLinkFor(ctx context.Context, name libkb.NormalizedUsername, uid keybase1.UID, g *libkb.GlobalContext) (ret *libkb.TrackChainLink, err error) {
	defer g.CTrace(ctx, fmt.Sprintf("identifyUser#trackChainLinkFor(%s)", name), func() error { return err })()

	if i.full != nil {
		g.Log.CDebugf(ctx, "| Using full user object")
		return i.full.TrackChainLinkFor(name, uid)
	}

	if i.thin != nil {

		g.Log.CDebugf(ctx, "| Using thin user object")

		// In the common case, we look at the thin UPAK and get the chain link
		// ID of the track chain link for tracking the given user. We'll then
		// go ahead and load that chain link from local level DB, and it's almost
		// always going to be there, since it was written as a side effect of
		// fetching the full user. There's a corner case, see just below...
		ret, err = libkb.TrackChainLinkFromUserPlusAllKeys(i.thin, name, uid, g)
		if _, inconsistent := err.(libkb.InconsistentCacheStateError); !inconsistent {
			g.Log.CDebugf(ctx, "| returning in common case -> (found=%v, err=%v)", (ret != nil), err)
			return ret, err
		}

		g.Log.CDebugf(ctx, "| fell through to forceFullLoad corner case")

		//
		// NOTE(max) 2016-12-31
		//
		// There's a corner case here -- the track chain link does exist, but
		// it wasn't found on disk. This is probably because the db cache was nuked.
		// Thus, in this case we force a full user reload, and we're sure to get
		// the tracking infomation then.
		//
		// See Jira ticket CORE-4310
		//
		err = i.forceFullLoad(g)
		if err != nil {
			return nil, err
		}
		return i.full.TrackChainLinkFor(name, uid)
	}

	// No user loaded, so no track chain link.
	g.Log.CDebugf(ctx, "| fell through the empty default case")
	return nil, nil
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

	arg           *keybase1.Identify2Arg
	testArgs      *Identify2WithUIDTestArgs
	trackToken    keybase1.TrackToken
	confirmResult keybase1.ConfirmResult
	cachedRes     *keybase1.Identify2Res

	// If we just resolved a user, then we can plumb this through to loadUser()
	ResolveBody *jsonw.Wrapper

	me   *identifyUser
	them *identifyUser

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

func (e *Identify2WithUID) resetError(err error) error {

	if err == nil {
		return nil
	}

	// Check to see if this is an identify failure, and if not just return. If it is, we want
	// to check what identify mode we are in here before returning an error.
	if !libkb.IsIdentifyProofError(err) {
		return err
	}

	if e.arg.IdentifyBehavior.WarningInsteadOfErrorOnBrokenTracks() {
		e.G().Log.Debug("| Reset err from %v -> nil since caller is 'CHAT_GUI'", err)
		return nil
	}

	return err
}

// Run then engine
func (e *Identify2WithUID) Run(ctx *Context) (err error) {

	e.SetGlobalContext(ctx.CloneGlobalContextWithLogTags(e.G(), "ID2"))

	n := fmt.Sprintf("Identify2WithUID#Run(UID=%v, Assertion=%s)", e.arg.Uid, e.arg.UserAssertion)
	defer e.G().CTraceTimed(ctx.GetNetContext(), n, func() error { return err })()
	e.G().Log.Debug("| Full Arg: %+v", e.arg)

	if e.arg.Uid.IsNil() {
		return libkb.NoUIDError{}
	}

	// Only the first send matters, but we don't want to block the subsequent no-op
	// sends. This code will break when we have more than 100 unblocking opporttunities.
	ch := make(chan error, 100)

	e.resultCh = ch
	go e.run(ctx)
	err = <-ch

	// Potentially reset the error based on the error and the calling context.
	err = e.resetError(err)
	return err
}

func (e *Identify2WithUID) run(ctx *Context) {
	err := e.runReturnError(ctx)
	e.unblock( /* isFinal */ true, err)

	// always cancel IdentifyUI to allow clients to clean up.
	// If no identifyUI was specified (because running the background)
	// then don't do anything.
	if ctx.IdentifyUI != nil {
		ctx.IdentifyUI.Cancel()
	}
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

func (e *Identify2WithUID) untrackedFastPath(ctx *Context) (ret bool) {

	nctx := ctx.GetNetContext()
	defer e.G().CTraceOK(nctx, "Identify2WithUID#untrackedFastPath", func() bool { return ret })()

	if !e.arg.IdentifyBehavior.CanUseUntrackedFastPath() {
		e.G().Log.Debug("| Can't use untracked fast path due to identify behavior %v", e.arg.IdentifyBehavior)
		return false
	}

	if e.me == nil || e.them == nil {
		e.G().Log.Debug("| Can't use untracked fast path since failed to load users")
		return false
	}

	if e.testArgs != nil && !e.testArgs.allowUntrackedFastPath {
		e.G().Log.Debug("| Can't use untracked fast path since disallowed in test")
		return false
	}

	nun := e.them.GetNormalizedName()

	tcl, err := e.me.trackChainLinkFor(nctx, nun, e.them.GetUID(), e.G())
	if err != nil {
		e.G().Log.CDebugf(nctx, "| Error getting track chain link: %s", err)
		return false
	}

	if tcl != nil {
		e.G().Log.CDebugf(nctx, "| Track found for %s", nun.String())
		return false
	}

	if e.testArgs != nil {
		e.testArgs.stats.untrackedFastPaths++
	}

	return true
}

func (e *Identify2WithUID) runReturnError(ctx *Context) (err error) {

	netCtx := ctx.GetNetContext()

	e.G().Log.CDebugf(netCtx, "+ acquire singleflight lock for %s", e.arg.Uid)
	lock := locktab.AcquireOnName(netCtx, e.G(), e.arg.Uid.String())
	e.G().Log.CDebugf(netCtx, "- acquired singleflight lock")

	defer func() {
		e.G().Log.CDebugf(netCtx, "+ Releasing singleflight lock for %s", e.arg.Uid)
		lock.Release(ctx.GetNetContext())
		e.G().Log.CDebugf(netCtx, "- Released singleflight lock")
	}()

	if err = e.loadAssertion(); err != nil {
		return err
	}

	if e.hitFastCache() {
		e.G().Log.CDebugf(netCtx, "| hit fast cache")
		return nil
	}

	e.G().Log.CDebugf(netCtx, "| Identify2WithUID.loadUsers")
	if err = e.loadUsers(ctx); err != nil {
		return err
	}

	if err = e.checkLocalAssertions(); err != nil {
		return err
	}

	if e.isSelfLoad() && !e.arg.NoSkipSelf && !e.useRemoteAssertions() {
		e.G().Log.CDebugf(netCtx, "| was a self load, short-circuiting")
		e.maybeCacheSelf()
		return nil
	}

	// If we are rekeying or reclaiming quota from KBFS, then let's
	// skip the external checks.
	if e.arg.IdentifyBehavior.SkipExternalChecks() {
		e.G().Log.CDebugf(netCtx, "| skip external checks specified, short-circuiting")
		return nil
	}

	if !e.useRemoteAssertions() && e.allowEarlyOuts() {

		if e.untrackedFastPath(ctx) {
			e.G().Log.CDebugf(netCtx, "| used untracked fast path")
			return nil
		}

		if e.checkSlowCacheHit() {
			e.G().Log.CDebugf(netCtx, "| hit slow cache, first check")
			return nil
		}
	}

	e.G().Log.Debug("| Identify2WithUID.createIdentifyState")
	if err = e.createIdentifyState(ctx); err != nil {
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
		e.G().Log.CDebugf(netCtx, "| Early fail due to missing remote assertions")
		return err
	}

	if e.useRemoteAssertions() && e.allowEarlyOuts() && e.checkSlowCacheHit() {
		e.G().Log.CDebugf(netCtx, "| hit slow cache, second check")
		return nil
	}

	// If we're not using tracking and we're not using remote assertions,
	// we can unblock the RPC caller here, and perform the identifyUI operations
	// in the background. NOTE: we need to copy out our background context,
	// since it will the foreground context will disappear after we unblock.
	bgNetCtx := libkb.CopyTagsToBackground(netCtx)

	if !e.useTracking && !e.useRemoteAssertions() && e.allowEarlyOuts() {
		e.unblock( /* isFinal */ false, nil)
	}

	ctx.SetNetContext(bgNetCtx)
	if err = e.runIdentifyUI(bgNetCtx, ctx); err != nil {
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
		v := e.exportToResult()
		e.getCache().Insert(v)
	}
}

func (e *Identify2WithUID) exportToResult() *keybase1.Identify2Res {
	if e.them == nil {
		return nil
	}
	return &keybase1.Identify2Res{
		Upk:         e.toUserPlusKeys(),
		TrackBreaks: e.trackBreaks,
	}
}

func (e *Identify2WithUID) maybeCacheResult() {

	isOK := e.state.Result().IsOK()
	canCacheFailures := e.arg.IdentifyBehavior.WarningInsteadOfErrorOnBrokenTracks()

	e.G().Log.Debug("+ maybeCacheResult (ok=%v; canCacheFailures=%v)", isOK, canCacheFailures)
	defer e.G().Log.Debug("- maybeCacheResult")

	if e.getCache() == nil {
		e.G().Log.Debug("| cache is disabled, so nothing to do")
		return
	}

	// If we hit an identify failure, and we're not allowed to cache failures,
	// then at least bust out the cache.
	if !isOK && !canCacheFailures {
		e.G().Log.Debug("| clearing cache due to failure")
		uid := e.them.GetUID()
		e.getCache().Delete(uid)
		if err := e.removeSlowCacheFromDB(); err != nil {
			e.G().Log.Debug("| Error in removing slow cache from db: %s", err)
		}
		return
	}

	// Common case --- (isOK || canCacheFailures)
	v := e.exportToResult()
	if v == nil {
		e.G().Log.Debug("| not caching; nil result")
		return
	}
	e.getCache().Insert(v)
	e.G().VDL.Log(libkb.VLog1, "| insert %+v", v)

	// Don't write failures to the disk cache
	if isOK {
		if err := e.storeSlowCacheToDB(); err != nil {
			e.G().Log.Debug("| Error in storing slow cache to db: %s", err)
		}
	}
	return
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

func (e *Identify2WithUID) displayUserCardAsync(ctx context.Context, iui libkb.IdentifyUI) <-chan error {
	if e.arg.IdentifyBehavior.WarningInsteadOfErrorOnBrokenTracks() {
		return nil
	}
	return displayUserCardAsync(ctx, e.G(), iui, e.them.GetUID(), (e.me != nil))
}

func (e *Identify2WithUID) runIdentifyUI(netContext context.Context, ctx *Context) (err error) {
	e.G().Log.CDebugf(netContext, "+ runIdentifyUI(%s)", e.them.GetName())
	defer e.G().Log.CDebugf(netContext, "- runIdentifyUI(%s) -> %s", e.them.GetName(), libkb.ErrToOk(err))

	// RemoteReceived, start with the baseProofSet that has PGP
	// fingerprints and the user's UID and username.
	e.remotesReceived = e.them.BaseProofSet()

	iui := ctx.IdentifyUI
	if e.arg.IdentifyBehavior.ShouldSuppressTrackerPopups() {
		e.G().Log.CDebugf(netContext, "| using the loopback identify UI")
		iui = newLoopbackIdentifyUI(e.G(), &e.trackBreaks)
	} else if e.useTracking && e.arg.CanSuppressUI && !e.arg.ForceDisplay {
		iui = newBufferedIdentifyUI(e.G(), iui, keybase1.ConfirmResult{
			IdentityConfirmed: true,
		})
	}

	e.G().Log.CDebugf(netContext, "| IdentifyUI.Start(%s)", e.them.GetName())
	if err = iui.Start(e.them.GetName(), e.arg.Reason, e.arg.ForceDisplay); err != nil {
		return err
	}
	for _, k := range e.identifyKeys {
		if err = iui.DisplayKey(k); err != nil {
			return err
		}
	}
	e.G().Log.CDebugf(netContext, "| IdentifyUI.ReportLastTrack(%s)", e.them.GetName())
	if err = iui.ReportLastTrack(libkb.ExportTrackSummary(e.state.TrackLookup(), e.them.GetName())); err != nil {
		return err
	}
	e.G().Log.CDebugf(netContext, "| IdentifyUI.LaunchNetworkChecks(%s)", e.them.GetName())
	if err = iui.LaunchNetworkChecks(e.state.ExportToUncheckedIdentity(), e.them.Export()); err != nil {
		return err
	}

	waiter := e.displayUserCardAsync(netContext, iui)

	e.G().Log.CDebugf(netContext, "| IdentifyUI.Identify(%s)", e.them.GetName())
	var them *libkb.User
	them, err = e.them.User(e.getCache())
	if err != nil {
		return err
	}

	itm := libkb.IdentifyTableModeActive
	if e.arg.IdentifyBehavior.ShouldSuppressTrackerPopups() {
		itm = libkb.IdentifyTableModePassive
	}

	if them.IDTable() == nil {
		e.G().Log.CDebugf(netContext, "| No IDTable for user")
	} else if err = them.IDTable().Identify(ctx.GetNetContext(), e.state, e.forceRemoteCheck(), iui, e, itm); err != nil {
		e.G().Log.CDebugf(netContext, "| Failure in running IDTable")
		return err
	}

	if waiter != nil {
		e.G().Log.CDebugf(netContext, "+ Waiting for UserCard")
		if err = <-waiter; err != nil {
			e.G().Log.CDebugf(netContext, "| Failure in showing UserCard")
			return err
		}
		e.G().Log.CDebugf(netContext, "- Waited for UserCard")
	}

	// use Confirm to display the IdentifyOutcome
	outcome := e.state.Result()
	outcome.TrackOptions = e.trackOptions
	e.confirmResult, err = iui.Confirm(outcome.Export())
	if err != nil {
		e.G().Log.CDebugf(netContext, "| Failure in iui.Confirm")
		return err
	}

	e.insertTrackToken(ctx, outcome, iui)

	if err = iui.Finish(); err != nil {
		e.G().Log.CDebugf(netContext, "| Failure in iui.Finish")
		return err
	}
	e.G().Log.CDebugf(netContext, "| IdentifyUI.Finished(%s)", e.them.GetName())

	err = e.checkRemoteAssertions([]keybase1.ProofState{keybase1.ProofState_OK})
	e.maybeCacheResult()

	if err == nil && !e.arg.NoErrorOnTrackFailure {
		// We only care about tracking errors in this case; hence GetErrorLax
		_, err = e.state.Result().GetErrorLax()
	}

	return err
}

func (e *Identify2WithUID) forceRemoteCheck() bool {
	return e.arg.ForceRemoteCheck || (e.testArgs != nil && e.testArgs.forceRemoteCheck)
}

func (e *Identify2WithUID) createIdentifyState(ctx *Context) (err error) {
	defer e.G().Trace("createIdentifyState", func() error { return err })()
	var them *libkb.User
	them, err = e.them.User(e.getCache())
	if err != nil {
		return err
	}

	e.state = libkb.NewIdentifyStateWithGregorItem(e.responsibleGregorItem, them)

	if e.testArgs != nil && e.testArgs.tcl != nil {
		e.G().Log.Debug("| using test track")
		e.useTracking = true
		e.state.SetTrackLookup(e.testArgs.tcl)
		return nil
	}

	if e.me == nil {
		e.G().Log.Debug("| null me")
		return nil
	}

	tcl, err := e.me.trackChainLinkFor(ctx.GetNetContext(), them.GetNormalizedName(), them.GetUID(), e.G())
	if tcl != nil {
		e.G().Log.Debug("| using track token %s", tcl.LinkID())
		e.useTracking = true
		e.state.SetTrackLookup(tcl)
		if ttcl, _ := libkb.TmpTrackChainLinkFor(e.me.GetUID(), them.GetUID(), e.G()); ttcl != nil {
			e.G().Log.Debug("| also have temporary track")
			e.state.SetTmpTrackLookup(ttcl)
		}
	}

	return nil
}

// RequiredUIs returns the required UIs.
func (e *Identify2WithUID) RequiredUIs() []libkb.UIKind {
	ret := []libkb.UIKind{}
	if e.arg == nil || !e.arg.IdentifyBehavior.ShouldSuppressTrackerPopups() {
		ret = append(ret, libkb.IdentifyUIKind)
	}
	return ret
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
	e.me, err = loadIdentifyUser(ctx, e.G(), libkb.NewLoadUserByUIDArg(ctx.GetNetContext(), e.G(), uid), e.getCache())
	return err
}

func (e *Identify2WithUID) loadThem(ctx *Context) (err error) {
	arg := libkb.NewLoadUserArg(e.G())
	arg.UID = e.arg.Uid
	arg.ResolveBody = e.ResolveBody
	arg.PublicKeyOptional = true
	e.them, err = loadIdentifyUser(ctx, e.G(), arg, e.getCache())
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

func (e *Identify2WithUID) checkFastCacheHit() (hit bool) {
	prfx := fmt.Sprintf("Identify2WithUID#checkFastCacheHit(%s)", e.arg.Uid)
	defer e.G().ExitTraceOK(prfx, func() bool { return hit })()
	if e.getCache() == nil {
		return false
	}

	fn := func(u keybase1.Identify2Res) keybase1.Time { return u.Upk.Uvv.CachedAt }
	dfn := func(u keybase1.Identify2Res) time.Duration {
		return libkb.Identify2CacheShortTimeout
	}
	u, err := e.getCache().Get(e.arg.Uid, fn, dfn, e.arg.IdentifyBehavior.WarningInsteadOfErrorOnBrokenTracks())

	if err != nil {
		e.G().Log.Debug("| fast cache error for %s: %s", e.arg.Uid, err)
	}
	if u == nil {
		return false
	}
	e.cachedRes = u
	return true
}

func (e *Identify2WithUID) dbKey(them keybase1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBIdentify,
		Key: fmt.Sprintf("%s-%s", e.me.GetUID(), them),
	}
}

func (e *Identify2WithUID) loadSlowCacheFromDB() (ret *keybase1.Identify2Res) {
	defer e.G().ExitTraceOK("Identify2WithUID#loadSlowCacheFromDB", func() bool { return ret != nil })()

	if e.getCache() != nil && !e.getCache().UseDiskCache() {
		e.G().Log.Debug("| Disk cached disabled")
		return nil
	}

	var ktm keybase1.Time
	key := e.dbKey(e.them.GetUID())
	found, err := e.G().LocalDb.GetInto(&ktm, key)
	if err != nil {
		e.G().Log.Debug("| Error loading key %+v from cache: %s", key, err)
		return nil
	}
	if !found {
		e.G().Log.Debug("| Key wasn't found: %+v", key)
		return nil
	}
	tm := ktm.Time()
	now := e.getNow()
	diff := now.Sub(tm)
	if diff > libkb.Identify2CacheLongTimeout {
		e.G().Log.Debug("| Object timed out %s ago", diff)
		return nil
	}
	var tmp keybase1.Identify2Res
	tmp.Upk = e.them.ExportToUserPlusKeys(ktm)
	ret = &tmp
	return ret
}

// Store (meUID, themUID) -> SuccessfulIDTime as we cache users to the slow cache.
// Thus, after a cold boot, we don't start up with a cold identify cache.
func (e *Identify2WithUID) storeSlowCacheToDB() (err error) {
	prfx := fmt.Sprintf("Identify2WithUID#storeSlowCacheToDB(%s)", e.them.GetUID())
	defer e.G().ExitTrace(prfx, func() error { return err })()
	if e.me == nil {
		e.G().Log.Debug("not storing to persistent slow cache since no me user")
		return nil
	}

	key := e.dbKey(e.them.GetUID())
	now := keybase1.ToTime(time.Now())
	err = e.G().LocalDb.PutObj(key, nil, now)
	return err
}

// Remove (themUID) from the identify cache, if they're there.
func (e *Identify2WithUID) removeSlowCacheFromDB() (err error) {
	prfx := fmt.Sprintf("Identify2WithUID#removeSlowCacheFromDB(%s)", e.them.GetUID())
	defer e.G().Trace(prfx, func() error { return err })()
	if e.me == nil {
		e.G().Log.Debug("not removing from persistent slow cache since no me user")
		return nil
	}
	key := e.dbKey(e.them.GetUID())
	err = e.G().LocalDb.Delete(key)
	return err
}

func (e *Identify2WithUID) checkSlowCacheHit() (ret bool) {
	prfx := fmt.Sprintf("Identify2WithUID#checkSlowCacheHit(%s)", e.them.GetUID())
	defer e.G().ExitTraceOK(prfx, func() bool { return ret })()

	if e.getCache() == nil {
		return false
	}

	tfn := func(u keybase1.Identify2Res) keybase1.Time { return u.Upk.Uvv.LastIdentifiedAt }
	dfn := func(u keybase1.Identify2Res) time.Duration {
		if u.TrackBreaks != nil {
			return libkb.Identify2CacheBrokenTimeout
		}
		return libkb.Identify2CacheLongTimeout
	}
	u, err := e.getCache().Get(e.them.GetUID(), tfn, dfn, e.arg.IdentifyBehavior.WarningInsteadOfErrorOnBrokenTracks())

	trackBrokenError := false
	if err != nil {
		e.G().Log.Debug("| slow cache error for %s: %s", e.them.GetUID(), err)
		if _, ok := err.(libkb.TrackBrokenError); ok {
			trackBrokenError = true
		}
	}

	if u == nil && e.me != nil && !trackBrokenError {
		u = e.loadSlowCacheFromDB()
	}

	if u == nil {
		e.G().Log.Debug("| %s: identify missed cache", prfx)
		return false
	}

	if !e.them.IsCachedIdentifyFresh(&u.Upk) {
		e.G().Log.Debug("| %s: cached identify was stale", prfx)
		return false
	}

	e.cachedRes = u

	// Update so that it hits the fast cache the next time
	u.Upk.Uvv.CachedAt = keybase1.ToTime(time.Now())
	return true
}

func (e *Identify2WithUID) Result() *keybase1.Identify2Res {
	if e.cachedRes != nil {
		return e.cachedRes
	}
	return e.exportToResult()
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

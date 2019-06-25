// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"
	"sync"
	"time"

	gregor "github.com/keybase/client/go/gregor"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

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
	arg       libkb.LoadUserArg
	full      *libkb.User
	thin      *keybase1.UserPlusKeysV2AllIncarnations
	isDeleted bool
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

func (i *identifyUser) GetStatus() keybase1.StatusCode {
	if i.thin != nil {
		return i.thin.GetStatus()
	}
	if i.full != nil {
		return i.full.GetStatus()
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
		tmp := i.thin.ExportToSimpleUser()
		return &tmp
	}
	if i.full != nil {
		return i.full.Export()
	}
	panic("null user")
}

func (i *identifyUser) ExportToUserPlusKeysV2AllIncarnations() (*keybase1.UserPlusKeysV2AllIncarnations, error) {
	if i.thin != nil {
		return i.thin, nil
	}
	if i.full != nil {
		return i.full.ExportToUPKV2AllIncarnations()
	}
	return nil, errors.New("null user in identify2: ExportToUserPlusKeysV2AllIncarnations")
}

func (i *identifyUser) IsCachedIdentifyFresh(upk *keybase1.UserPlusKeysV2AllIncarnations) bool {
	if i.thin != nil {
		ret := i.thin.Uvv.Equal(upk.Uvv)
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
	i.thin, i.full, err = g.GetUPAKLoader().LoadV2(i.arg)
	return err
}

func (i *identifyUser) forceFullLoad(m libkb.MetaContext) (err error) {
	arg := i.arg.WithForceReload()
	i.thin, i.full, err = m.G().GetUPAKLoader().LoadV2(arg)
	return err
}

func (i *identifyUser) isNil() bool {
	return i.thin == nil && i.full == nil
}

func (i *identifyUser) Full() *libkb.User {
	return i.full
}

func loadIdentifyUser(m libkb.MetaContext, arg libkb.LoadUserArg, cache libkb.Identify2Cacher) (*identifyUser, error) {
	ret := &identifyUser{arg: arg}
	err := ret.load(m.G())
	if ret.isNil() {
		ret = nil
	} else if ret.full != nil && cache != nil {
		cache.DidFullUserLoad(ret.GetUID())
	}
	return ret, err
}

func (i *identifyUser) trackChainLinkFor(m libkb.MetaContext, name libkb.NormalizedUsername, uid keybase1.UID) (ret *libkb.TrackChainLink, err error) {
	defer m.Trace(fmt.Sprintf("identifyUser#trackChainLinkFor(%s)", name), func() error { return err })()

	if i.full != nil {
		m.Debug("| Using full user object")
		return i.full.TrackChainLinkFor(m, name, uid)
	}

	if i.thin != nil {

		m.Debug("| Using thin user object")

		// In the common case, we look at the thin UPAK and get the chain link
		// ID of the track chain link for tracking the given user. We'll then
		// go ahead and load that chain link from local level DB, and it's almost
		// always going to be there, since it was written as a side effect of
		// fetching the full user. There's a corner case, see just below...
		ret, err = libkb.TrackChainLinkFromUPK2AI(m, i.thin, name, uid)
		if _, inconsistent := err.(libkb.InconsistentCacheStateError); !inconsistent {
			m.Debug("| returning in common case -> (found=%v, err=%v)", (ret != nil), err)
			return ret, err
		}

		m.Debug("| fell through to forceFullLoad corner case")

		//
		// NOTE(max) 2016-12-31
		//
		// There's a corner case here -- the track chain link does exist, but
		// it wasn't found on disk. This is probably because the db cache was nuked.
		// Thus, in this case we force a full user reload, and we're sure to get
		// the tracking information then.
		//
		// See Jira ticket CORE-4310
		//
		err = i.forceFullLoad(m)
		if err != nil {
			return nil, err
		}
		return i.full.TrackChainLinkFor(m, name, uid)
	}

	// No user loaded, so no track chain link.
	m.Debug("| fell through the empty default case")
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
	cachedRes     *keybase1.Identify2ResUPK2

	metaContext libkb.MetaContext

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

var _ (Engine2) = (*Identify2WithUID)(nil)
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

func (e *Identify2WithUID) resetError(m libkb.MetaContext, inErr error) (outErr error) {

	defer m.Trace(fmt.Sprintf("Identify2WithUID#resetError(%s)", libkb.ErrToOk(inErr)), func() error { return outErr })()

	if inErr == nil {
		return nil
	}

	// Check to see if this is an identify failure, and if not just return. If it is, we want
	// to check what identify mode we are in here before returning an error.
	if !libkb.IsIdentifyProofError(inErr) {
		return inErr
	}

	if e.arg.IdentifyBehavior.WarningInsteadOfErrorOnBrokenTracks() {
		m.Debug("| Reset err from %v -> nil since caller is '%s' %d", inErr, e.arg.IdentifyBehavior, e.arg.IdentifyBehavior)
		return nil
	}

	return inErr
}

// Run then engine
func (e *Identify2WithUID) Run(m libkb.MetaContext) (err error) {

	m = m.WithLogTag("ID2")

	n := fmt.Sprintf("Identify2WithUID#Run(UID=%v, Assertion=%s)", e.arg.Uid, e.arg.UserAssertion)
	defer m.TraceTimed(n, func() error { return err })()
	m.Debug("| Full Arg: %+v", e.arg)

	if e.arg.Uid.IsNil() {
		return libkb.NoUIDError{}
	}

	// Only the first send matters, but we don't want to block the subsequent no-op
	// sends. This code will break when we have more than 100 unblocking opportunities.
	ch := make(chan error, 100)

	e.resultCh = ch
	go e.run(m)
	err = <-ch

	// Potentially reset the error based on the error and the calling context.
	err = e.resetError(m, err)
	return err
}

func (e *Identify2WithUID) run(m libkb.MetaContext) {
	err := e.runReturnError(m)
	e.unblock(m /* isFinal */, true, err)

	// always cancel IdentifyUI to allow clients to clean up.
	// If no identifyUI was specified (because running the background)
	// then don't do anything.
	if m.UIs().IdentifyUI != nil {
		m.UIs().IdentifyUI.Cancel(m)
	}
}

func (e *Identify2WithUID) hitFastCache(m libkb.MetaContext) bool {

	if !e.allowCaching() {
		m.Debug("| missed fast cache: no caching allowed")
		return false
	}
	if e.useAnyAssertions() {
		m.Debug("| missed fast cache: has assertions")
		return false
	}
	if !e.allowEarlyOuts() {
		m.Debug("| missed fast cache: we don't allow early outs")
		return false
	}
	if !e.checkFastCacheHit(m) {
		m.Debug("| missed fast cache: didn't hit")
		return false
	}
	return true
}

func (e *Identify2WithUID) untrackedFastPath(m libkb.MetaContext) (ret bool) {

	defer m.TraceOK("Identify2WithUID#untrackedFastPath", func() bool { return ret })()

	if !e.arg.IdentifyBehavior.CanUseUntrackedFastPath() {
		m.Debug("| Can't use untracked fast path due to identify behavior %v", e.arg.IdentifyBehavior)
		return false
	}

	statInc := func() {
		if e.testArgs != nil {
			e.testArgs.stats.untrackedFastPaths++
		}
	}

	if e.testArgs != nil && !e.testArgs.allowUntrackedFastPath {
		m.Debug("| Can't use untracked fast path since disallowed in test")
		return false
	}

	if e.them == nil {
		m.Debug("| Can't use untracked fast path since failed to load them users")
		return false
	}

	nun := e.them.GetNormalizedName()

	// check if there's a tcl in the testArgs
	if e.testArgs != nil && e.testArgs.tcl != nil {
		trackedUsername, err := e.testArgs.tcl.GetTrackedUsername()
		if err == nil && trackedUsername == nun {
			m.Debug("| Test track link found for %s", nun.String())
			return false
		}
	}

	if e.me == nil {
		m.Debug("| Can use untracked fastpath since there is no logged in user")
		statInc()
		return true
	}

	tcl, err := e.me.trackChainLinkFor(m, nun, e.them.GetUID())
	if err != nil {
		m.Debug("| Error getting track chain link: %s", err)
		return false
	}

	if tcl != nil {
		m.Debug("| Track found for %s", nun.String())
		return false
	}

	statInc()
	return true
}

func (e *Identify2WithUID) runReturnError(m libkb.MetaContext) (err error) {

	m.Debug("+ acquire singleflight lock for %s", e.arg.Uid)
	lock, err := m.G().IDLocktab.AcquireOnNameWithContext(m.Ctx(), m.G(), e.arg.Uid.String())
	if err != nil {
		m.Debug("| error acquiring singleflight lock for %s: %v", e.arg.Uid, err)
		return err
	}
	m.Debug("- acquired singleflight lock")

	defer func() {
		m.Debug("+ Releasing singleflight lock for %s", e.arg.Uid)
		lock.Release(m.Ctx())
		m.Debug("- Released singleflight lock")
	}()

	if err = e.loadAssertion(m); err != nil {
		return err
	}

	if e.hitFastCache(m) {
		m.Debug("| hit fast cache")
		e.maybeNotify(m, "hit fast cache")
		return nil
	}

	m.Debug("| Identify2WithUID.loadUsers")
	if err = e.loadUsers(m); err != nil {
		return err
	}

	if err = e.checkLocalAssertions(); err != nil {
		return err
	}

	if e.isSelfLoad() && !e.arg.NoSkipSelf && !e.useRemoteAssertions() {
		m.Debug("| was a self load, short-circuiting")
		e.maybeCacheSelf(m)
		return nil
	}

	// If we are rekeying or reclaiming quota from KBFS, then let's
	// skip the external checks.
	if e.arg.IdentifyBehavior.SkipExternalChecks() {
		m.Debug("| skip external checks specified, short-circuiting")
		return nil
	}

	if !e.useRemoteAssertions() && e.allowEarlyOuts() {

		if e.untrackedFastPath(m) {
			m.Debug("| used untracked fast path")
			e.maybeNotify(m, "untracked fast path")
			return nil
		}

		if e.checkSlowCacheHit(m) {
			m.Debug("| hit slow cache, first check")
			e.maybeNotify(m, "slow cache, first check")
			return nil
		}
	}

	m.Debug("| Identify2WithUID.createIdentifyState")
	if err = e.createIdentifyState(m); err != nil {
		return err
	}

	if err = e.runIdentifyPrecomputation(); err != nil {
		return err
	}

	// First we check that all remote assertions as present for the user,
	// whether or not the remote check actually succeeds (hence the
	// ProofState_NONE check).
	okStates := []keybase1.ProofState{keybase1.ProofState_NONE, keybase1.ProofState_OK}
	if err = e.checkRemoteAssertions(okStates); err != nil {
		m.Debug("| Early fail due to missing remote assertions")
		return err
	}

	if e.useRemoteAssertions() && e.allowEarlyOuts() && e.checkSlowCacheHit(m) {
		m.Debug("| hit slow cache, second check")
		e.maybeNotify(m, "slow cache, second check")
		return nil
	}

	// If we're not using tracking and we're not using remote assertions,
	// we can unblock the RPC caller here, and perform the identifyUI operations
	// in the background. NOTE: we need to copy out our background context,
	// since it will the foreground context will disappear after we unblock.
	m = m.BackgroundWithLogTags()

	if (!e.useTracking && !e.useRemoteAssertions() && e.allowEarlyOuts()) || e.arg.IdentifyBehavior.UnblockThenForceIDTable() {
		e.unblock(m /* isFinal */, false, nil)
	}

	return e.runIdentifyUI(m)
}

func (e *Identify2WithUID) allowEarlyOuts() bool {
	return !e.arg.NeedProofSet && !e.arg.IdentifyBehavior.UnblockThenForceIDTable()
}

func (e *Identify2WithUID) getNow(m libkb.MetaContext) time.Time {
	if e.testArgs != nil && e.testArgs.clock != nil {
		return e.testArgs.clock()
	}
	return m.G().Clock().Now()
}

func (e *Identify2WithUID) unblock(m libkb.MetaContext, isFinal bool, err error) {
	m.Debug("| unblocking...")
	if e.arg.AlwaysBlock && !isFinal {
		m.Debug("| skipping unblock; isFinal=%v; AlwaysBlock=%v...", isFinal, e.arg.AlwaysBlock)
	} else {
		e.resultCh <- err
		m.Debug("| unblock sent...")
	}
}

func (e *Identify2WithUID) maybeCacheSelf(m libkb.MetaContext) {
	if e.getCache() != nil {
		v, err := e.exportToResult(m)
		if v != nil && err == nil {
			e.getCache().Insert(v)
		}
	}
}

// exportToResult either returns (non-nil, nil) on success, or (nil, non-nil) on error.
func (e *Identify2WithUID) exportToResult(m libkb.MetaContext) (*keybase1.Identify2ResUPK2, error) {
	if e.them == nil {
		// this should never happen
		return nil, libkb.UserNotFoundError{Msg: "failed to get a them user in Identify2WithUID#exportToResult"}
	}
	upk, err := e.toUserPlusKeysv2AllIncarnations()
	if err != nil {
		return nil, err
	}
	if upk == nil {
		// this should never happen
		return nil, libkb.UserNotFoundError{Msg: "failed export a them user in Identify2WithUID#exportToResult"}
	}
	return &keybase1.Identify2ResUPK2{
		Upk:          *upk,
		TrackBreaks:  e.trackBreaks,
		IdentifiedAt: keybase1.ToTime(e.getNow(m)),
	}, nil
}

func (e *Identify2WithUID) maybeCacheResult(m libkb.MetaContext) {

	isOK := e.state.Result().IsOK()
	canCacheFailures := e.arg.IdentifyBehavior.WarningInsteadOfErrorOnBrokenTracks()

	m.Debug("+ maybeCacheResult (ok=%v; canCacheFailures=%v)", isOK, canCacheFailures)
	defer m.Debug("- maybeCacheResult")

	if e.getCache() == nil {
		m.Debug("| cache is disabled, so nothing to do")
		return
	}

	// If we hit an identify failure, and we're not allowed to cache failures,
	// then at least bust out the cache.
	if !isOK && !canCacheFailures {
		m.Debug("| clearing cache due to failure")
		uid := e.them.GetUID()
		e.getCache().Delete(uid)
		if err := e.removeSlowCacheFromDB(m); err != nil {
			m.Debug("| Error in removing slow cache from db: %s", err)
		}
		return
	}

	// Common case --- (isOK || canCacheFailures)
	v, err := e.exportToResult(m)
	if err != nil {
		m.Debug("| not caching: error exporting: %s", err)
		return
	}
	if v == nil {
		m.Debug("| not caching; nil result")
		return
	}
	e.getCache().Insert(v)
	m.VLogf(libkb.VLog1, "| insert %+v", v)

	// Don't write failures to the disk cache
	if isOK {
		if err := e.storeSlowCacheToDB(m); err != nil {
			m.Debug("| Error in storing slow cache to db: %s", err)
		}
	}
}

func (e *Identify2WithUID) insertTrackToken(m libkb.MetaContext, outcome *libkb.IdentifyOutcome) (err error) {
	defer m.Trace("Identify2WithUID#insertTrackToken", func() error { return err })()
	e.trackToken, err = m.G().TrackCache().Insert(outcome)
	if err != nil {
		return err
	}
	return m.UIs().IdentifyUI.ReportTrackToken(m, e.trackToken)
}

// CCLCheckCompleted is triggered whenever a remote proof check completes.
// We get these calls as a result of being a "CheckCompletedListener".
// When each result comes in, we check against our pool of needed remote
// assertions. If the set is complete, or if one that we need errors,
// we can unblock the caller.
func (e *Identify2WithUID) CCLCheckCompleted(lcr *libkb.LinkCheckResult) {
	e.remotesMutex.Lock()
	defer e.remotesMutex.Unlock()
	m := e.metaContext

	m.Debug("+ CheckCompleted for %s", lcr.GetLink().ToIDString())
	defer m.Debug("- CheckCompleted")

	// Always add to remotesReceived list, so that we have a full ProofSet.
	pf := libkb.RemoteProofChainLinkToProof(lcr.GetLink())
	e.remotesReceived.Add(pf)

	if !e.useRemoteAssertions() || e.useTracking {
		m.Debug("| Not using remote assertions or is tracking")
		return
	}

	if !e.remoteAssertion.HasFactor(pf) {
		m.Debug("| Proof isn't needed in our remote-assertion early-out check: %v", pf)
		return
	}

	if err := lcr.GetError(); err != nil {
		m.Debug("| got error -> %v", err)
		e.remotesError = err
	}

	// note(maxtaco): this is a little ugly in that it's O(n^2) where n is the number
	// of identities in the assertion. But I can't imagine n > 3, so this is fine
	// for now.
	matched := e.remoteAssertion.MatchSet(*e.remotesReceived)
	m.Debug("| matched -> %v", matched)
	if matched {
		e.remotesCompleted = true
	}

	if e.remotesError != nil || e.remotesCompleted {
		m.Debug("| unblocking, with err = %v", e.remotesError)
		e.unblock(m, false, e.remotesError)
	}
}

func (e *Identify2WithUID) checkLocalAssertions() error {
	if !e.localAssertion.MatchSet(*e.them.BaseProofSet()) {
		return libkb.UnmetAssertionError{User: e.them.GetName(), Remote: false}
	}
	return nil
}

func (e *Identify2WithUID) checkRemoteAssertions(okStates []keybase1.ProofState) error {
	if e.them.isDeleted {
		if e.G().Env.GetReadDeletedSigChain() {
			return nil
		}
		return libkb.UnmetAssertionError{User: e.them.GetName(), Remote: true}
	}
	ps := libkb.NewProofSet(nil)
	e.state.Result().AddProofsToSet(ps, okStates)
	if !e.remoteAssertion.MatchSet(*ps) {
		return libkb.UnmetAssertionError{User: e.them.GetName(), Remote: true}
	}
	return nil
}

func (e *Identify2WithUID) loadAssertion(mctx libkb.MetaContext) (err error) {
	if len(e.arg.UserAssertion) == 0 {
		return nil
	}
	e.themAssertion, err = libkb.AssertionParseAndOnly(e.G().MakeAssertionContext(mctx), e.arg.UserAssertion)
	if err == nil {
		e.remoteAssertion, e.localAssertion = libkb.CollectAssertions(e.themAssertion)
	}
	return err
}

func (e *Identify2WithUID) useAnyAssertions() bool {
	return e.useLocalAssertions() || e.useRemoteAssertions()
}

func (e *Identify2WithUID) allowCaching() bool {
	return e.arg.IdentifyBehavior.AllowCaching()
}

func (e *Identify2WithUID) useLocalAssertions() bool {
	return e.localAssertion.Len() > 0
}

// If we need a ProofSet, it's as if we need remote assertions.
func (e *Identify2WithUID) useRemoteAssertions() bool {
	return (e.remoteAssertion.Len() > 0)
}

func (e *Identify2WithUID) runIdentifyPrecomputation() (err error) {

	keyDiffDisplayHook := func(k keybase1.IdentifyKey) error {
		e.identifyKeys = append(e.identifyKeys, k)
		return nil
	}
	revokedKeyHook := func(id libkb.TrackIDComponent, diff libkb.TrackDiff) {
		if diff == nil {
			return
		}
		ipb := keybase1.IdentifyProofBreak{
			RemoteProof: libkb.ExportTrackIDComponentToRevokedProof(id).Proof,
			Lcr: keybase1.LinkCheckResult{
				Diff:           libkb.ExportTrackDiff(diff),
				BreaksTracking: true,
			},
		}
		if e.trackBreaks == nil {
			e.trackBreaks = &keybase1.IdentifyTrackBreaks{}
		}
		e.trackBreaks.Proofs = append(e.trackBreaks.Proofs, ipb)
	}
	e.state.Precompute(keyDiffDisplayHook, revokedKeyHook)
	return nil
}

func (e *Identify2WithUID) displayUserCardAsync(m libkb.MetaContext) <-chan error {
	// Skip showing the userCard if we are allowing deleted users since this
	// will error out.
	if e.arg.IdentifyBehavior.SkipUserCard() || e.G().Env.GetReadDeletedSigChain() {
		return nil
	}
	return libkb.DisplayUserCardAsync(m, e.them.GetUID(), (e.me != nil))
}

func (e *Identify2WithUID) setupIdentifyUI(m libkb.MetaContext) libkb.MetaContext {
	if e.arg.IdentifyBehavior.ShouldSuppressTrackerPopups() {
		m.Debug("| using the loopback identify UI")
		iui := NewLoopbackIdentifyUI(m.G(), &e.trackBreaks)
		m = m.WithIdentifyUI(iui)
	} else if e.useTracking && e.arg.CanSuppressUI && !e.arg.ForceDisplay {
		iui := newBufferedIdentifyUI(m.G(), m.UIs().IdentifyUI, keybase1.ConfirmResult{
			IdentityConfirmed: true,
		})
		m = m.WithIdentifyUI(iui)
	}
	return m
}

func (e *Identify2WithUID) runIdentifyUI(m libkb.MetaContext) (err error) {
	n := fmt.Sprintf("+ runIdentifyUI(%s)", e.them.GetName())
	defer m.Trace(n, func() error { return err })()

	// RemoteReceived, start with the baseProofSet that has PGP
	// fingerprints and the user's UID and username.
	e.remotesReceived = e.them.BaseProofSet()

	m = e.setupIdentifyUI(m)
	iui := m.UIs().IdentifyUI

	m.Debug("| IdentifyUI.Start(%s)", e.them.GetName())
	if err = iui.Start(m, e.them.GetName(), e.arg.Reason, e.arg.ForceDisplay); err != nil {
		return err
	}
	for _, k := range e.identifyKeys {
		if err = iui.DisplayKey(m, k); err != nil {
			return err
		}
	}
	m.Debug("| IdentifyUI.ReportLastTrack(%s)", e.them.GetName())
	if err = iui.ReportLastTrack(m, libkb.ExportTrackSummary(e.state.TrackLookup(), e.them.GetName())); err != nil {
		return err
	}
	m.Debug("| IdentifyUI.LaunchNetworkChecks(%s)", e.them.GetName())
	if err = iui.LaunchNetworkChecks(m, e.state.ExportToUncheckedIdentity(m), e.them.Export()); err != nil {
		return err
	}

	waiter := e.displayUserCardAsync(m)

	m.Debug("| IdentifyUI.Identify(%s)", e.them.GetName())
	var them *libkb.User
	them, err = e.them.User(e.getCache())
	if err != nil {
		return err
	}

	identifyTableMode := libkb.IdentifyTableModeActive
	if e.arg.IdentifyBehavior.ShouldSuppressTrackerPopups() {
		identifyTableMode = libkb.IdentifyTableModePassive
	}

	// When we get a callback from IDTabe().Identify, we don't get to thread our metacontext
	// through (for now), so stash it in the this.
	e.metaContext = m
	if them.IDTable() == nil {
		m.Debug("| No IDTable for user")
	} else if err = them.IDTable().Identify(m, e.state, e.forceRemoteCheck(), iui, e, identifyTableMode); err != nil {
		m.Debug("| Failure in running IDTable")
		return err
	}

	if waiter != nil {
		m.Debug("+ Waiting for UserCard")
		if err = <-waiter; err != nil {
			m.Debug("| Failure in showing UserCard")
			return err
		}
		m.Debug("- Waited for UserCard")
	}

	// use Confirm to display the IdentifyOutcome
	outcome := e.state.Result()
	outcome.TrackOptions = e.trackOptions
	e.confirmResult, err = iui.Confirm(m, outcome.Export(e.G()))
	if err != nil {
		m.Debug("| Failure in iui.Confirm")
		return err
	}

	e.insertTrackToken(m, outcome)

	if err = iui.Finish(m); err != nil {
		m.Debug("| Failure in iui.Finish")
		return err
	}
	m.Debug("| IdentifyUI.Finished(%s)", e.them.GetName())

	err = e.checkRemoteAssertions([]keybase1.ProofState{keybase1.ProofState_OK})
	e.maybeCacheResult(m)

	if err == nil && !e.arg.NoErrorOnTrackFailure {
		// We only care about tracking errors in this case; hence GetErrorLax
		_, err = e.state.Result().GetErrorLax()
	}

	if outcome.IsOK() {
		e.maybeNotify(m, "runIdentifyUI complete IsOk")
	}

	return err
}

func (e *Identify2WithUID) forceRemoteCheck() bool {
	return e.arg.ForceRemoteCheck || (e.testArgs != nil && e.testArgs.forceRemoteCheck)
}

func (e *Identify2WithUID) createIdentifyState(m libkb.MetaContext) (err error) {
	defer m.Trace("createIdentifyState", func() error { return err })()
	var them *libkb.User
	them, err = e.them.User(e.getCache())
	if err != nil {
		return err
	}

	e.state = libkb.NewIdentifyStateWithGregorItem(m.G(), e.responsibleGregorItem, them)

	if e.testArgs != nil && e.testArgs.tcl != nil {
		m.Debug("| using test track")
		e.useTracking = true
		e.state.SetTrackLookup(e.testArgs.tcl)
		return nil
	}

	if e.me == nil {
		m.Debug("| null me")
		return nil
	}

	tcl, err := e.me.trackChainLinkFor(m, them.GetNormalizedName(), them.GetUID())
	if tcl != nil {
		m.Debug("| using track token %s", tcl.LinkID())
		e.useTracking = true
		e.state.SetTrackLookup(tcl)
		if ttcl, _ := libkb.TmpTrackChainLinkFor(m, e.me.GetUID(), them.GetUID()); ttcl != nil {
			m.Debug("| also have temporary track")
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

func (e *Identify2WithUID) loadUserOpts(arg libkb.LoadUserArg) libkb.LoadUserArg {
	if !e.allowCaching() {
		arg = arg.WithForcePoll(true)
	}
	return arg
}

func (e *Identify2WithUID) loadMe(m libkb.MetaContext, uid keybase1.UID) (err error) {

	// Short circuit loadMe for testing
	if e.testArgs != nil && e.testArgs.noMe {
		return nil
	}
	arg := libkb.NewLoadUserArgWithMetaContext(m).WithUID(uid).WithSelf(true).WithStubMode(libkb.StubModeUnstubbed)
	e.me, err = loadIdentifyUser(m, e.loadUserOpts(arg), e.getCache())
	return err
}

func (e *Identify2WithUID) loadThem(m libkb.MetaContext) (err error) {
	arg := e.loadUserOpts(libkb.NewLoadUserArgWithMetaContext(m).WithUID(e.arg.Uid).WithResolveBody(e.ResolveBody).WithPublicKeyOptional())
	e.them, err = loadIdentifyUser(m, arg, e.getCache())
	if err != nil {
		switch err.(type) {
		case libkb.NoKeyError:
			// convert this error to NoSigChainError
			return libkb.NoSigChainError{}
		case libkb.NotFoundError:
			return libkb.UserNotFoundError{UID: e.arg.Uid, Msg: "in Identify2WithUID"}
		default: // including libkb.UserDeletedError
			return err
		}
	}
	if e.them == nil {
		return libkb.UserNotFoundError{UID: e.arg.Uid, Msg: "in Identify2WithUID"}
	}
	err = libkb.UserErrorFromStatus(e.them.GetStatus())
	if _, ok := err.(libkb.UserDeletedError); ok && e.arg.IdentifyBehavior.AllowDeletedUsers() || e.G().Env.GetReadDeletedSigChain() {
		e.them.isDeleted = true
		return nil
	}
	return err
}

func (e *Identify2WithUID) loadUsers(m libkb.MetaContext) (err error) {
	var loadMeErr, loadThemErr error

	var selfLoad bool
	var wg sync.WaitGroup

	if !e.arg.ActLoggedOut {
		loggedIn, myUID := isLoggedIn(m)
		if loggedIn {
			selfLoad = myUID.Equal(e.arg.Uid)
			wg.Add(1)
			go func() {
				loadMeErr = e.loadMe(m, myUID)
				wg.Done()
			}()
		}
	}

	if !selfLoad {
		wg.Add(1)
		go func() {
			loadThemErr = e.loadThem(m)
			wg.Done()
		}()
	}
	wg.Wait()

	if loadMeErr != nil {
		return loadMeErr
	}
	if loadThemErr != nil {
		return loadThemErr
	}

	if selfLoad {
		e.them = e.me
	}

	return nil
}

func (e *Identify2WithUID) checkFastCacheHit(m libkb.MetaContext) (hit bool) {
	prfx := fmt.Sprintf("Identify2WithUID#checkFastCacheHit(%s)", e.arg.Uid)
	defer m.ExitTraceOK(prfx, func() bool { return hit })()
	if e.getCache() == nil {
		return false
	}

	fn := func(u keybase1.Identify2ResUPK2) keybase1.Time { return u.Upk.Uvv.CachedAt }
	dfn := func(u keybase1.Identify2ResUPK2) time.Duration {
		return libkb.Identify2CacheShortTimeout
	}
	u, err := e.getCache().Get(e.arg.Uid, fn, dfn, e.arg.IdentifyBehavior.WarningInsteadOfErrorOnBrokenTracks())

	if err != nil {
		m.Debug("| fast cache error for %s: %s", e.arg.Uid, err)
	}
	if u == nil {
		m.Debug("| fast cache returning false on nil output")
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

func (e *Identify2WithUID) loadSlowCacheFromDB(m libkb.MetaContext) (ret *keybase1.Identify2ResUPK2) {
	defer m.ExitTraceOK("Identify2WithUID#loadSlowCacheFromDB", func() bool { return ret != nil })()

	if e.getCache() != nil && !e.getCache().UseDiskCache() {
		m.Debug("| Disk cached disabled")
		return nil
	}

	var ktm keybase1.Time
	key := e.dbKey(e.them.GetUID())
	found, err := e.G().LocalDb.GetInto(&ktm, key)
	if err != nil {
		m.Debug("| Error loading key %+v from cache: %s", key, err)
		return nil
	}
	if !found {
		m.Debug("| Key wasn't found: %+v", key)
		return nil
	}
	tm := ktm.Time()
	now := e.getNow(m)
	diff := now.Sub(tm)
	if diff > libkb.Identify2CacheLongTimeout {
		m.Debug("| Object timed out %s ago", diff)
		return nil
	}
	var tmp keybase1.Identify2ResUPK2
	upk2ai, err := e.them.ExportToUserPlusKeysV2AllIncarnations()
	if err != nil {
		m.Warning("| Failed to export: %s", err)
		return nil
	}
	tmp.Upk = *upk2ai
	tmp.IdentifiedAt = ktm
	ret = &tmp
	return ret
}

// Store (meUID, themUID) -> SuccessfulIDTime as we cache users to the slow cache.
// Thus, after a cold boot, we don't start up with a cold identify cache.
func (e *Identify2WithUID) storeSlowCacheToDB(m libkb.MetaContext) (err error) {
	prfx := fmt.Sprintf("Identify2WithUID#storeSlowCacheToDB(%s)", e.them.GetUID())
	defer e.G().ExitTrace(prfx, func() error { return err })()
	if e.me == nil {
		m.Debug("not storing to persistent slow cache since no me user")
		return nil
	}

	key := e.dbKey(e.them.GetUID())
	now := keybase1.ToTime(e.getNow(m))
	err = e.G().LocalDb.PutObj(key, nil, now)
	return err
}

// Remove (themUID) from the identify cache, if they're there.
func (e *Identify2WithUID) removeSlowCacheFromDB(m libkb.MetaContext) (err error) {
	prfx := fmt.Sprintf("Identify2WithUID#removeSlowCacheFromDB(%s)", e.them.GetUID())
	defer e.G().Trace(prfx, func() error { return err })()
	if e.me == nil {
		m.Debug("not removing from persistent slow cache since no me user")
		return nil
	}
	key := e.dbKey(e.them.GetUID())
	err = e.G().LocalDb.Delete(key)
	return err
}

func (e *Identify2WithUID) checkSlowCacheHit(m libkb.MetaContext) (ret bool) {
	prfx := fmt.Sprintf("Identify2WithUID#checkSlowCacheHit(%s)", e.them.GetUID())
	defer m.ExitTraceOK(prfx, func() bool { return ret })()

	if e.getCache() == nil {
		return false
	}

	if !e.allowCaching() {
		m.Debug("| missed fast cache: no caching allowed")
		return false
	}

	timeFn := func(u keybase1.Identify2ResUPK2) keybase1.Time { return u.IdentifiedAt }
	durationFn := func(u keybase1.Identify2ResUPK2) time.Duration {
		if u.TrackBreaks != nil {
			return libkb.Identify2CacheBrokenTimeout
		}
		return libkb.Identify2CacheLongTimeout
	}
	u, err := e.getCache().Get(e.them.GetUID(), timeFn, durationFn, e.arg.IdentifyBehavior.WarningInsteadOfErrorOnBrokenTracks())

	trackBrokenError := false
	if err != nil {
		m.Debug("| slow cache error for %s: %s", e.them.GetUID(), err)
		if _, ok := err.(libkb.TrackBrokenError); ok {
			trackBrokenError = true
		}
	}

	if u == nil && e.me != nil && !trackBrokenError {
		u = e.loadSlowCacheFromDB(m)
	}

	if u == nil {
		m.Debug("| %s: identify missed cache", prfx)
		return false
	}

	if !e.them.IsCachedIdentifyFresh(&u.Upk) {
		m.Debug("| %s: cached identify was stale", prfx)
		return false
	}

	e.cachedRes = u

	// Update so that it hits the fast cache the next time
	u.Upk.Uvv.CachedAt = keybase1.ToTime(e.getNow(m))
	e.getCache().Insert(u)
	return true
}

// Result will return (non-nil,nil) on success, and (nil,non-nil) on failure.
func (e *Identify2WithUID) Result(m libkb.MetaContext) (*keybase1.Identify2ResUPK2, error) {
	if e.cachedRes != nil {
		return e.cachedRes, nil
	}
	res, err := e.exportToResult(m)
	if err != nil {
		return nil, err
	}
	if res == nil {
		return nil, libkb.UserNotFoundError{Msg: "identify2 unexpectly returned an empty user"}
	}
	return res, nil
}

func (e *Identify2WithUID) GetProofSet() *libkb.ProofSet {
	return e.remotesReceived
}

func (e *Identify2WithUID) GetIdentifyOutcome() *libkb.IdentifyOutcome {
	return e.state.Result()
}

func (e *Identify2WithUID) toUserPlusKeysv2AllIncarnations() (*keybase1.UserPlusKeysV2AllIncarnations, error) {
	return e.them.ExportToUserPlusKeysV2AllIncarnations()
}

func (e *Identify2WithUID) getCache() libkb.Identify2Cacher {
	if e.testArgs != nil && e.testArgs.cache != nil {
		return e.testArgs.cache
	}
	if e.testArgs != nil && e.testArgs.noCache {
		return nil
	}
	return e.G().Identify2Cache()
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

func (e *Identify2WithUID) FullMeUser() *libkb.User {
	if e.me == nil {
		return nil
	}
	return e.me.Full()
}

func (e *Identify2WithUID) FullThemUser() *libkb.User {
	if e.them == nil {
		return nil
	}
	return e.them.Full()
}

func (e *Identify2WithUID) maybeNotify(mctx libkb.MetaContext, explanation string) {
	target := e.arg.Uid
	if e.them != nil {
		target = e.them.GetUID()
	}
	if e.me == nil {
		// This check is needed because ActLoggedOut causes the untracked fast path
		// to succeed even when the true active user is tracking the identifyee.
		mctx.Debug("Identify2WithUID.maybeNotify(%v, %v) nope missing ME", target, explanation)
	}
	if target.IsNil() {
		mctx.Debug("Identify2WithUID.maybeNotify(%v, %v) nope missing UID", target, explanation)
		return
	}
	if e.arg.IdentifyBehavior.WarningInsteadOfErrorOnBrokenTracks() {
		mctx.Debug("Identify2WithUID.maybeNotify(%v, %v) nope WarningInsteadOfErrorOnBrokenTracks", target, explanation)
		return
	}
	mctx.Debug("Identify2WithUID.maybeNotify(%v, %v) -> sending", target, explanation)
	go mctx.G().IdentifyDispatch.NotifyTrackingSuccess(mctx, target)
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"context"
	"fmt"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type CheckResult struct {
	Contextified
	Status       ProofError // Or nil if it was a success
	VerifiedHint *SigHint   // client provided verified hint if any
	Time         time.Time  // When the last check was
	PvlHash      string     // Added after other fields. Some entries may not have this packed.
}

func (cr CheckResult) Pack() *jsonw.Wrapper {
	p := jsonw.NewDictionary()
	if cr.Status != nil {
		s := jsonw.NewDictionary()
		_ = s.SetKey("code", jsonw.NewInt(int(cr.Status.GetProofStatus())))
		_ = s.SetKey("desc", jsonw.NewString(cr.Status.GetDesc()))
		_ = p.SetKey("status", s)
		if cr.VerifiedHint != nil {
			_ = p.SetKey("verified_hint", cr.VerifiedHint.MarshalToJSON())
		}
	}
	_ = p.SetKey("time", jsonw.NewInt64(cr.Time.Unix()))
	_ = p.SetKey("pvlhash", jsonw.NewString(cr.PvlHash))
	return p
}

func (cr CheckResult) Freshness() keybase1.CheckResultFreshness {
	now := cr.G().Clock().Now()
	age := now.Sub(cr.Time)
	switch {
	case cr.Status == nil:
		switch {
		case age < cr.G().Env.GetProofCacheMediumDur():
			return keybase1.CheckResultFreshness_FRESH
		case age < cr.G().Env.GetProofCacheLongDur():
			return keybase1.CheckResultFreshness_AGED
		}
	case ProofErrorIsPvlBad(cr.Status):
		// Don't use cache results for pvl problems.
		// The hope is that they will soon be resolved server-side.
		return keybase1.CheckResultFreshness_RANCID
	case !ProofErrorIsSoft(cr.Status):
		if age < cr.G().Env.GetProofCacheShortDur() {
			return keybase1.CheckResultFreshness_FRESH
		}
	default:
		// don't use cache results for "soft" errors (500s, timeouts)
		// see issue #140
	}
	return keybase1.CheckResultFreshness_RANCID
}

func NewNowCheckResult(g *GlobalContext, pe ProofError) *CheckResult {
	return &CheckResult{
		Contextified: NewContextified(g),
		Status:       pe,
		Time:         g.Clock().Now(),
	}
}

func NewCheckResult(g *GlobalContext, jw *jsonw.Wrapper) (res *CheckResult, err error) {
	var ignoreErr error
	var t int64
	var code int
	var desc string
	var pvlHash string

	jw.AtKey("time").GetInt64Void(&t, &err)
	jw.AtKey("pvlhash").GetStringVoid(&pvlHash, &ignoreErr)
	verifiedHint, err := NewSigHint(jw.AtKey("verified_hint"))
	if err != nil {
		return nil, err
	}

	status := jw.AtKey("status")
	var pe ProofError
	if !status.IsNil() {
		status.AtKey("desc").GetStringVoid(&desc, &err)
		status.AtKey("code").GetIntVoid(&code, &err)
		pe = NewProofError(keybase1.ProofStatus(code), "%s", desc)
	}
	if err != nil {
		return nil, err
	}
	res = &CheckResult{
		Contextified: NewContextified(g),
		Status:       pe,
		VerifiedHint: verifiedHint,
		Time:         time.Unix(t, 0),
		PvlHash:      pvlHash,
	}
	return res, nil
}

type ProofCache struct {
	Contextified
	capac int
	lru   *lru.Cache
	sync.RWMutex
	noDisk bool

	flightMu sync.Mutex
	flights  *lru.Cache
}

// proofCheckFlightCapacity bounds the singleflight table. It is a memory bound
// only: an entry is shareable exactly while its check is still running, so how
// long a finished entry lingers before eviction can't affect what any caller
// gets back.
const proofCheckFlightCapacity = 500

// ProofCheckFlight is one outbound remote proof check that other identify
// sessions may share instead of issuing a duplicate request of their own.
type ProofCheckFlight struct {
	startedAt time.Time
	doneCh    chan struct{}

	// Only valid once doneCh is closed.
	hint   *SigHint
	err    ProofError
	usable bool
}

func (f *ProofCheckFlight) finish(hint *SigHint, err ProofError, usable bool) {
	f.hint = hint
	f.err = err
	f.usable = usable
	close(f.doneCh)
}

// finished reports whether the check is done. Only meaningful under flightMu,
// where it gates reuse of the flight's result fields.
func (f *ProofCheckFlight) finished() bool {
	select {
	case <-f.doneCh:
		return true
	default:
		return false
	}
}

// wait blocks until the shared check finishes. usable is false either because
// the result can't stand in for the caller's own check (the owning goroutine was
// canceled, or it panicked before producing one) or because the caller's own ctx
// died first. Callers must fall back to their own check, which the second case
// makes pointless -- hence the separate ctx error check at the call site.
func (f *ProofCheckFlight) wait(ctx context.Context) (hint *SigHint, err ProofError, usable bool) {
	select {
	case <-f.doneCh:
		return f.hint, f.err, f.usable
	case <-ctx.Done():
		return nil, nil, false
	}
}

// CheckFlightBegin either registers the caller as the one that will perform the
// outbound proof check for key (returning mine), or hands back a check another
// session already has going that can answer for the caller (returning theirs).
//
// A check is shareable only while it is still running, and only if it started at
// or after requestedAt (when the caller asked for it). Both halves are needed to
// keep this a pure singleflight rather than a second result cache: requestedAt
// is stamped when the identify begins but the check runs much later, after the
// user load and the identify UI round trip, so an already-finished flight can
// easily satisfy the start-time test while its answer is seconds old. Requiring
// the check to still be in flight means every caller either does the work or
// waits on work that is genuinely happening during its own request.
func (pc *ProofCache) CheckFlightBegin(key string, requestedAt, now time.Time) (mine, theirs *ProofCheckFlight) {
	if pc == nil {
		return nil, nil
	}

	pc.flightMu.Lock()
	defer pc.flightMu.Unlock()

	if pc.flights == nil {
		l, err := lru.New(proofCheckFlightCapacity)
		if err != nil {
			return nil, nil
		}
		pc.flights = l
	}

	// A zero requestedAt would make every entry look eligible, so callers that
	// can't say when they asked never share.
	if !requestedAt.IsZero() {
		if tmp, found := pc.flights.Get(key); found {
			if f, ok := tmp.(*ProofCheckFlight); ok && !f.startedAt.Before(requestedAt) {
				// A finished flight is a result, not work in progress, and this
				// table is not a result cache -- keeping it would let one check
				// answer callers arbitrarily long after it completed. Drop it so
				// this caller leads a fresh one that others can share.
				if !f.finished() {
					return nil, f
				}
				pc.flights.Remove(key)
			}
		}
	}

	f := &ProofCheckFlight{startedAt: now, doneCh: make(chan struct{})}
	pc.flights.Add(key, f)
	return f, nil
}

func NewProofCache(g *GlobalContext, capac int) *ProofCache {
	return &ProofCache{Contextified: NewContextified(g), capac: capac}
}

func (pc *ProofCache) DisableDisk() {
	pc.Lock()
	defer pc.Unlock()
	pc.noDisk = true
}

func (pc *ProofCache) Reset() error {
	pc.flightMu.Lock()
	if pc.flights != nil {
		pc.flights.Purge()
	}
	pc.flightMu.Unlock()

	pc.Lock()
	defer pc.Unlock()
	return pc.initCache()
}

func (pc *ProofCache) setup() error {
	pc.Lock()
	defer pc.Unlock()
	if pc.lru != nil {
		return nil
	}
	return pc.initCache()
}

func (pc *ProofCache) initCache() error {
	lru, err := lru.New(pc.capac)
	if err != nil {
		return err
	}
	pc.lru = lru
	return nil
}

func (pc *ProofCache) memGet(sid keybase1.SigID) *CheckResult {
	if err := pc.setup(); err != nil {
		return nil
	}

	pc.RLock()
	defer pc.RUnlock()

	tmp, found := pc.lru.Get(sid)
	if !found {
		return nil
	}
	cr, ok := tmp.(CheckResult)
	if !ok {
		pc.G().Log.Errorf("Bad type assertion in ProofCache.Get")
		return nil
	}
	if cr.Freshness() == keybase1.CheckResultFreshness_RANCID {
		pc.lru.Remove(sid)
		return nil
	}
	return &cr
}

func (pc *ProofCache) memPut(sid keybase1.SigID, cr CheckResult) {
	if err := pc.setup(); err != nil {
		return
	}

	pc.RLock()
	defer pc.RUnlock()

	pc.lru.Add(sid, cr)
}

func (pc *ProofCache) memDelete(sid keybase1.SigID) {
	if err := pc.setup(); err != nil {
		return
	}
	pc.RLock()
	defer pc.RUnlock()
	pc.lru.Remove(sid)
}

func (pc *ProofCache) Get(sid keybase1.SigID, pvlHash keybase1.MerkleStoreKitHash) *CheckResult {
	if pc == nil {
		return nil
	}

	cr := pc.memGet(sid)
	if cr == nil {
		cr = pc.dbGet(sid)
	}
	if cr == nil {
		return nil
	}

	if cr.PvlHash == "" {
		pc.G().Log.Debug("^ ProofCache ignoring entry with pvl-hash empty")
		return nil
	}
	if cr.PvlHash != string(pvlHash) {
		pc.G().Log.Debug("^ ProofCache ignoring entry with pvl-hash mismatch")
		return nil
	}

	return cr
}

func (pc *ProofCache) dbKey(sid keybase1.SigID) (DbKey, string) {
	sidstr := sid.String()
	key := DbKey{Typ: DBProofCheck, Key: sidstr}
	return key, sidstr
}

func (pc *ProofCache) dbGet(sid keybase1.SigID) (cr *CheckResult) {
	dbkey, sidstr := pc.dbKey(sid)

	pc.G().Log.Debug("+ ProofCache.dbGet(%s)", sidstr)
	defer func() {
		pc.G().Log.Debug("- ProofCache.dbGet(%s) -> %v", sidstr, (cr != nil))
	}()

	if pc.noDisk {
		pc.G().Log.Debug("| disk proof cache disabled")
		return nil
	}

	jw, err := pc.G().LocalDb.Get(dbkey)
	if err != nil {
		pc.G().Log.Errorf("Error lookup up proof check in DB: %s", err)
		return nil
	}
	if jw == nil {
		pc.G().Log.Debug("| Cached CheckResult for %s wasn't found ", sidstr)
		return nil
	}

	cr, err = NewCheckResult(pc.G(), jw)
	if err != nil {
		pc.G().Log.Errorf("Bad cached CheckResult for %s", sidstr)
		return nil
	}

	if cr.Freshness() == keybase1.CheckResultFreshness_RANCID {
		if err := pc.G().LocalDb.Delete(dbkey); err != nil {
			pc.G().Log.Errorf("Delete error: %s", err)
		}
		pc.G().Log.Debug("| Cached CheckResult for %s wasn't fresh", sidstr)
		return nil
	}

	return cr
}

func (pc *ProofCache) dbPut(sid keybase1.SigID, cr CheckResult) error {
	if pc.noDisk {
		return nil
	}

	dbkey, _ := pc.dbKey(sid)
	jw := cr.Pack()
	return pc.G().LocalDb.Put(dbkey, []DbKey{}, jw)
}

func (pc *ProofCache) dbDelete(sid keybase1.SigID) error {
	if pc.noDisk {
		return nil
	}
	dbkey, _ := pc.dbKey(sid)
	return pc.G().LocalDb.Delete(dbkey)
}

func (pc *ProofCache) Put(sid keybase1.SigID, lcr *LinkCheckResult, pvlHash keybase1.MerkleStoreKitHash) error {
	if pc == nil {
		return nil
	}
	cr := CheckResult{
		Contextified: pc.Contextified,
		Status:       lcr.err,
		VerifiedHint: lcr.verifiedHint,
		Time:         pc.G().Clock().Now(),
		PvlHash:      string(pvlHash),
	}
	pc.memPut(sid, cr)
	return pc.dbPut(sid, cr)
}

func (pc *ProofCache) Delete(sid keybase1.SigID) error {
	if pc == nil {
		return fmt.Errorf("nil ProofCache")
	}
	pc.memDelete(sid)
	return pc.dbDelete(sid)
}

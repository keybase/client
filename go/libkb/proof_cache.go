// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type CheckResult struct {
	Contextified
	Status  ProofError // Or nil if it was a success
	Time    time.Time  // When the last check was
	PvlHash string     // Added after other fields. Some entries may not have this packed.
}

func (cr CheckResult) Pack() *jsonw.Wrapper {
	p := jsonw.NewDictionary()
	if cr.Status != nil {
		s := jsonw.NewDictionary()
		s.SetKey("code", jsonw.NewInt(int(cr.Status.GetProofStatus())))
		s.SetKey("desc", jsonw.NewString(cr.Status.GetDesc()))
		p.SetKey("status", s)
	}
	p.SetKey("time", jsonw.NewInt64(cr.Time.Unix()))
	p.SetKey("pvlhash", jsonw.NewString(cr.PvlHash))
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
	status := jw.AtKey("status")
	var pe ProofError

	if !status.IsNil() {
		status.AtKey("desc").GetStringVoid(&desc, &err)
		status.AtKey("code").GetIntVoid(&code, &err)
		pe = NewProofError(keybase1.ProofStatus(code), desc)
	}
	if err == nil {
		res = &CheckResult{
			Contextified: NewContextified(g),
			Status:       pe,
			Time:         time.Unix(t, 0),
			PvlHash:      pvlHash,
		}
	}
	return
}

type ProofCache struct {
	Contextified
	capac int
	lru   *lru.Cache
	sync.RWMutex
	noDisk bool
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

func (pc *ProofCache) Get(sid keybase1.SigID, pvlHash PvlKitHash) *CheckResult {
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
	sidstr := sid.ToString(true)
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

func (pc *ProofCache) Put(sid keybase1.SigID, pe ProofError, pvlHash PvlKitHash) error {
	if pc == nil {
		return nil
	}
	cr := CheckResult{
		Contextified: pc.Contextified,
		Status:       pe,
		Time:         pc.G().Clock().Now(),
		PvlHash:      string(pvlHash),
	}
	pc.memPut(sid, cr)
	return pc.dbPut(sid, cr)
}

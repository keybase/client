package libkb

import (
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

type CheckResult struct {
	Status ProofError // Or nil if it was a success
	Time   time.Time  // When the last check was
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
	return p
}

func (cr CheckResult) ToDisplayString() string {
	return "[cached " + FormatTime(cr.Time) + "]"
}

func (cr CheckResult) IsFresh() bool {
	// XXX  Might also want two separate timeouts for no error and hard failures.

	var interval time.Duration
	if cr.Status == nil {
		interval = G.Env.GetProofCacheLongDur()
	} else if ProofErrorIsSoft(cr.Status) {
		interval = G.Env.GetProofCacheShortDur()
	} else {
		interval = G.Env.GetProofCacheMediumDur()
	}
	return (time.Since(cr.Time) < interval)
}

func NewNowCheckResult(pe ProofError) *CheckResult {
	return &CheckResult{pe, time.Now()}
}

func NewCheckResult(jw *jsonw.Wrapper) (res *CheckResult, err error) {
	var t int64
	var code int
	var desc string

	jw.AtKey("time").GetInt64Void(&t, &err)
	status := jw.AtKey("status")
	var pe ProofError

	if !status.IsNil() {
		status.AtKey("desc").GetStringVoid(&desc, &err)
		status.AtKey("code").GetIntVoid(&code, &err)
		pe = NewProofError(keybase1.ProofStatus(code), desc)
	}
	if err == nil {
		res = &CheckResult{
			Status: pe,
			Time:   time.Unix(t, 0),
		}
	}
	return
}

type ProofCache struct {
	lru   *lru.Cache
	mutex *sync.Mutex
}

func NewProofCache(capac int) (*ProofCache, error) {
	lru, err := lru.New(capac)
	if err != nil {
		return nil, err
	}
	ret := &ProofCache{lru, new(sync.Mutex)}
	return ret, nil
}

func (pc *ProofCache) memGet(sid keybase1.SigID) *CheckResult {
	tmp, found := pc.lru.Get(sid)
	if !found {
		return nil
	}
	cr, ok := tmp.(CheckResult)
	if !ok {
		G.Log.Errorf("Bad type assertion in ProofCache.Get")
		return nil
	}
	if !cr.IsFresh() {
		pc.lru.Remove(sid)
		return nil
	}
	return &cr
}

func (pc *ProofCache) memPut(sid keybase1.SigID, cr CheckResult) {
	pc.lru.Add(sid, cr)
}

func (pc *ProofCache) Get(sid keybase1.SigID) *CheckResult {
	if pc == nil {
		return nil
	}
	pc.mutex.Lock()
	defer pc.mutex.Unlock()

	cr := pc.memGet(sid)
	if cr == nil {
		cr = pc.dbGet(sid)
	}
	return cr
}

func (pc ProofCache) dbKey(sid keybase1.SigID) (DbKey, string) {
	sidstr := sid.ToString(true)
	key := DbKey{Typ: DBProofCheck, Key: sidstr}
	return key, sidstr
}

func (pc *ProofCache) dbGet(sid keybase1.SigID) (cr *CheckResult) {
	dbkey, sidstr := pc.dbKey(sid)

	G.Log.Debug("+ ProofCache.dbGet(%s)", sidstr)
	defer G.Log.Debug("- ProofCache.dbGet(%s) -> %v", sidstr, (cr != nil))

	jw, err := G.LocalDb.Get(dbkey)
	if err != nil {
		G.Log.Errorf("Error lookup up proof check in DB: %s", err)
		return nil
	}
	if jw == nil {
		G.Log.Debug("| Cached CheckResult for %s wasn't found ", sidstr)
		return nil
	}

	cr, err = NewCheckResult(jw)
	if err != nil {
		G.Log.Errorf("Bad cached CheckResult for %s", sidstr)
		return nil
	}

	if !cr.IsFresh() {
		if err := G.LocalDb.Delete(dbkey); err != nil {
			G.Log.Errorf("Delete error: %s", err)
		}
		G.Log.Debug("| Cached CheckResult for %s wasn't fresh", sidstr)
		return nil
	}

	return cr
}

func (pc *ProofCache) dbPut(sid keybase1.SigID, cr CheckResult) error {
	dbkey, _ := pc.dbKey(sid)
	jw := cr.Pack()
	return G.LocalDb.Put(dbkey, []DbKey{}, jw)
}

func (pc *ProofCache) Put(sid keybase1.SigID, pe ProofError) error {
	if pc == nil {
		return nil
	}
	pc.mutex.Lock()
	defer pc.mutex.Unlock()
	cr := CheckResult{pe, time.Now()}
	pc.memPut(sid, cr)
	return pc.dbPut(sid, cr)
}

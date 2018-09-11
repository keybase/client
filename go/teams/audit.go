package teams

import (
	"crypto/rand"
	"fmt"
	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/pipeliner"
	"math/big"
	"sort"
	"sync"
	"time"
)

type AuditParams struct {
	RootFreshness time.Duration
	// After this many new Merkle updates, another audit is triggered.
	MerkleMovementTrigger keybase1.Seqno
	NumPreProbes          int
	NumPostProbes         int
	Parallelism           int
	LRUSize               int
}

var desktopParams = AuditParams{
	RootFreshness:         time.Minute,
	MerkleMovementTrigger: keybase1.Seqno(1000),
	NumPreProbes:          25,
	NumPostProbes:         25,
	Parallelism:           5,
	LRUSize:               1000,
}

var mobileParams = AuditParams{
	RootFreshness:         10 * time.Minute,
	MerkleMovementTrigger: keybase1.Seqno(10000),
	NumPreProbes:          10,
	NumPostProbes:         10,
	Parallelism:           3,
	LRUSize:               500,
}

var devParams = AuditParams{
	RootFreshness:         10 * time.Minute,
	MerkleMovementTrigger: keybase1.Seqno(10000),
	NumPreProbes:          3,
	NumPostProbes:         3,
	Parallelism:           3,
	LRUSize:               500,
}

// getAuditParams will return parameters based on the platform. On mobile,
// we're going to be performing a smaller audit, and therefore have a smaller
// security margin (1-2^10). But it's worth it given the bandwidth and CPU
// constraints.
func getAuditParams(m libkb.MetaContext) AuditParams {
	if m.G().Env.GetRunMode() == libkb.DevelRunMode {
		return devParams
	}
	if libkb.IsMobilePlatform() {
		return mobileParams
	}
	return desktopParams
}

type Auditor struct {

	// single-flight lock on TeamID
	locktab libkb.LockTable

	// Map of TeamID -> AuditHistory
	// The LRU is protected by a mutex, because it's swapped out on logout.
	lruMutex sync.Mutex
	lru      *lru.Cache
}

// NewAuditor makes a new auditor
func NewAuditor(g *libkb.GlobalContext) *Auditor {
	ret := &Auditor{}
	ret.newLRU(libkb.NewMetaContextBackground(g))
	return ret
}

// NewAuditorAndInstall makes a new Auditor and dangles it
// off of the given GlobalContext.
func NewAuditorAndInstall(g *libkb.GlobalContext) *Auditor {
	a := NewAuditor(g)
	g.SetTeamAuditor(a)
	return a
}

// AuditTeam runs an audit on the links of the given team chain (or team chain suffix).
// The security factor of the audit is a function of the hardcoded parameters above,
// and the amount of time since the last audit. This method should use some sort of
// long-lived cache (via local DB) so that previous audits can be combined with the
// current one. headMerkleSeqno is is the Merkle Root claimed in the head of the team.
// maxSeqno is the maximum seqno of the chainLinks passed; that is, the highest
// Seqno for which chain[s] is defined.
func (a *Auditor) AuditTeam(m libkb.MetaContext, id keybase1.TeamID, isPublic bool, headMerkleSeqno keybase1.Seqno, chain map[keybase1.Seqno]keybase1.LinkID, maxSeqno keybase1.Seqno) (err error) {

	m = m.WithLogTag("AUDIT")
	defer m.CTraceTimed(fmt.Sprintf("Auditor#AuditTeam(%+v)", id), func() error { return err })()

	if id.IsPublic() != isPublic {
		return NewBadPublicError(id, isPublic)
	}

	// Single-flight lock by team ID.
	lock := a.locktab.AcquireOnName(m.Ctx(), m.G(), id.String())
	defer lock.Release(m.Ctx())

	return a.auditLocked(m, id, headMerkleSeqno, chain, maxSeqno)
}

func (a *Auditor) getLRU() *lru.Cache {
	a.lruMutex.Lock()
	defer a.lruMutex.Unlock()
	return a.lru
}

func (a *Auditor) getFromLRU(m libkb.MetaContext, id keybase1.TeamID, lru *lru.Cache) *keybase1.AuditHistory {
	tmp, found := lru.Get(id)
	if !found {
		return nil
	}
	ret, ok := tmp.(*keybase1.AuditHistory)
	if !ok {
		m.CErrorf("Bad type assertion in Auditor#getFromLRU")
		return nil
	}
	return ret
}

func (a *Auditor) getFromDisk(m libkb.MetaContext, id keybase1.TeamID) (*keybase1.AuditHistory, error) {
	var ret keybase1.AuditHistory
	found, err := m.G().LocalDb.GetInto(&ret, libkb.DbKey{Typ: libkb.DBTeamAuditor, Key: string(id)})
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	return &ret, nil
}

func (a *Auditor) getFromCache(m libkb.MetaContext, id keybase1.TeamID, lru *lru.Cache) (*keybase1.AuditHistory, error) {

	ret := a.getFromLRU(m, id, lru)
	if ret != nil {
		return ret, nil
	}
	ret, err := a.getFromDisk(m, id)
	return ret, err
}

func (a *Auditor) putToCache(m libkb.MetaContext, id keybase1.TeamID, lru *lru.Cache, h *keybase1.AuditHistory) (err error) {
	lru.Add(id, h)
	err = m.G().LocalDb.PutObj(libkb.DbKey{Typ: libkb.DBTeamAuditor, Key: string(id)}, nil, *h)
	return err
}

func (a *Auditor) checkRecent(m libkb.MetaContext, history *keybase1.AuditHistory, root *libkb.MerkleRoot) bool {
	if root == nil {
		m.CDebugf("no recent known merkle root in checkRecent")
		return false
	}
	last := lastAudit(history)
	if last == nil {
		m.CDebugf("no recent audits")
		return false
	}
	diff := *root.Seqno() - last.MaxMerkleSeqno
	if diff >= getAuditParams(m).MerkleMovementTrigger {
		m.CDebugf("previous merkle audit was %v ago", diff)
		return false
	}
	return true
}

func lastAudit(h *keybase1.AuditHistory) *keybase1.Audit {
	if h == nil {
		return nil
	}
	if len(h.Audits) == 0 {
		return nil
	}
	ret := h.Audits[len(h.Audits)-1]
	return &ret
}

func makeHistory(history *keybase1.AuditHistory, id keybase1.TeamID) *keybase1.AuditHistory {
	if history == nil {
		return &keybase1.AuditHistory{
			ID:         id,
			Public:     id.IsPublic(),
			PreProbes:  make(map[keybase1.Seqno]keybase1.Probe),
			PostProbes: make(map[keybase1.Seqno]keybase1.Probe),
		}
	}
	ret := history.DeepCopy()
	return &ret
}

func (a *Auditor) doPostProbes(m libkb.MetaContext, history *keybase1.AuditHistory, probeID int, headMerkleSeqno keybase1.Seqno, latestMerkleSeqno keybase1.Seqno, chain map[keybase1.Seqno]keybase1.LinkID, maxChainSeqno keybase1.Seqno) (maxMerkleProbe keybase1.Seqno, err error) {
	defer m.CTrace("Auditor#doPostProbes", func() error { return err })()

	var low keybase1.Seqno
	last := lastAudit(history)
	var prev *probeTuple
	if last == nil {
		low = headMerkleSeqno
	} else {
		low = last.MaxMerkleSeqno
		probe, ok := history.PostProbes[last.MaxMerkleProbe]
		if !ok {
			return maxMerkleProbe, NewAuditError("previous audit pointed to a bogus probe (seqno=%d)", last.MaxMerkleProbe)
		}
		prev = &probeTuple{
			merkle: last.MaxMerkleProbe,
			team:   probe.TeamSeqno,
			// leave linkID nil, it's not needed...
		}
	}

	probeTuples, err := a.computeProbes(m, history.ID, history.PostProbes, probeID, low, latestMerkleSeqno, 0, getAuditParams(m).NumPostProbes)
	if err != nil {
		return maxMerkleProbe, err
	}
	if len(probeTuples) == 0 {
		m.CDebugf("No probe tuples, so bailing")
		return maxMerkleProbe, nil
	}

	for _, tuple := range probeTuples {
		m.CDebugf("postProbe: checking probe at %+v", tuple)

		// Note that we might see tuple.team == 0 in a legit case. There is a race here. If seqno=1
		// of team foo was made when the last merkle seqno was 2000, let's say, then for merkle seqnos
		// 2000-2001, the team foo might not be in the tree. So we'd expect the tuple.team to be 0
		// in that (unlikely) case. So we don't check the validity of the linkID in that case
		// (since it doesn't exist). However, we still do check that tuple.team's are non-decreasing,
		// so this 0 value is checked below (see comment).
		if tuple.team > keybase1.Seqno(0) {
			expectedLinkID, ok := chain[tuple.team]
			if !ok {
				return maxMerkleProbe, NewAuditError("team chain doesn't have a link for seqno %d, but expected one", tuple.team)
			}
			if !expectedLinkID.Eq(tuple.linkID) {
				return maxMerkleProbe, NewAuditError("team chain linkID mismatch at %d: wanted %s but got %s via merkle seqno %d", tuple.team, expectedLinkID, tuple.linkID, tuple.merkle)
			}
		}
		history.PostProbes[tuple.merkle] = keybase1.Probe{Index: probeID, TeamSeqno: tuple.team}

		// This condition is the key ordering condition. It is still checked in the case of the race
		// condition at tuple.team==0 mentioned just above.
		if prev != nil && prev.team > tuple.team {
			return maxMerkleProbe, NewAuditError("team chain unexpected jump: %d > %d via merkle seqno %d", prev.team, tuple.team, tuple.merkle)
		}
		if tuple.merkle > maxMerkleProbe {
			maxMerkleProbe = tuple.merkle
		}
		prev = &tuple
	}
	return maxMerkleProbe, nil
}

// doPreProbes probabilistically checks that no team occupied the slot before the team
// in question was created. It selects probes from before the team was created. Each
// probed leaf must not be occupied.
func (a *Auditor) doPreProbes(m libkb.MetaContext, history *keybase1.AuditHistory, probeID int, headMerkleSeqno keybase1.Seqno) (err error) {
	defer m.CTrace("Auditor#doPreProbes", func() error { return err })()

	first := m.G().MerkleClient.FirstSeqnoWithSkips(m)
	if first == nil {
		return NewAuditError("cannot find a first modern merkle sequence")
	}

	probeTuples, err := a.computeProbes(m, history.ID, history.PreProbes, probeID, *first, headMerkleSeqno, len(history.PreProbes), getAuditParams(m).NumPreProbes)
	if err != nil {
		return err
	}
	if len(probeTuples) == 0 {
		m.CDebugf("No probe pairs, so bailing")
		return nil
	}
	for _, tuple := range probeTuples {
		m.CDebugf("preProbe: checking probe at merkle %d", tuple.merkle)
		if tuple.team != keybase1.Seqno(0) || !tuple.linkID.IsNil() {
			return NewAuditError("merkle root at %v should have been nil for %v; got %s/%d",
				tuple.merkle, history.ID, tuple.linkID, tuple.team)
		}
	}
	return nil
}

// randSeqno picks a random number in [lo,hi] inclusively.
func randSeqno(lo keybase1.Seqno, hi keybase1.Seqno) (keybase1.Seqno, error) {
	rangeBig := big.NewInt(int64(hi - lo + 1))
	n, err := rand.Int(rand.Reader, rangeBig)
	if err != nil {
		return keybase1.Seqno(0), err
	}
	return keybase1.Seqno(n.Int64()) + lo, nil
}

type probeTuple struct {
	merkle keybase1.Seqno
	team   keybase1.Seqno
	linkID keybase1.LinkID
}

func (a *Auditor) computeProbes(m libkb.MetaContext, teamID keybase1.TeamID, probes map[keybase1.Seqno]keybase1.Probe, probeID int, left keybase1.Seqno, right keybase1.Seqno, probesInRange int, n int) (ret []probeTuple, err error) {
	ret, err = a.scheduleProbes(m, probes, probeID, left, right, probesInRange, n)
	if err != nil {
		return nil, err
	}
	err = a.lookupProbes(m, teamID, ret)
	if err != nil {
		return nil, err
	}
	return ret, err
}

func (a *Auditor) scheduleProbes(m libkb.MetaContext, probes map[keybase1.Seqno]keybase1.Probe, probeID int, left keybase1.Seqno, right keybase1.Seqno, probesInRange int, n int) (ret []probeTuple, err error) {
	defer m.CTrace(fmt.Sprintf("Auditor#scheduleProbes(left=%d,right=%d)", left, right), func() error { return err })()
	if probesInRange > n {
		m.CDebugf("no more probes needed; did %d, wanted %d", probesInRange, n)
		return nil, nil
	}
	rng := right - left + 1
	if int(rng) <= probesInRange {
		m.CDebugf("no more probes needed; range was only %d, and we did %d", rng, probesInRange)
		return nil, nil
	}
	for i := 0; i < n; i++ {
		x, err := randSeqno(left, right)
		if err != nil {
			return nil, err
		}
		if _, found := probes[x]; !found {
			ret = append(ret, probeTuple{merkle: x})
			probes[x] = keybase1.Probe{Index: probeID}
		}
	}
	sort.SliceStable(ret, func(i, j int) bool {
		return ret[i].merkle < ret[j].merkle
	})
	m.CDebugf("scheduled probes: %+v", ret)
	return ret, nil
}

func (a *Auditor) lookupProbe(m libkb.MetaContext, teamID keybase1.TeamID, probe *probeTuple) (err error) {
	defer m.CTrace(fmt.Sprintf("Auditor#lookupProbe(%v,%v)", teamID, *probe), func() error { return err })()
	leaf, _, err := m.G().MerkleClient.LookupLeafAtSeqnoForAudit(m, teamID.AsUserOrTeam(), probe.merkle)
	if err != nil {
		return err
	}
	if leaf == nil || leaf.Private == nil {
		m.CDebugf("nil leaf at %v/%v", teamID, probe.merkle)
		return nil
	}
	probe.team = leaf.Private.Seqno
	if leaf.Private.LinkID != nil {
		probe.linkID = leaf.Private.LinkID.Export()
	}
	return nil
}

func (a *Auditor) lookupProbes(m libkb.MetaContext, teamID keybase1.TeamID, tuples []probeTuple) (err error) {
	pipeliner := pipeliner.NewPipeliner(getAuditParams(m).Parallelism)
	for i := range tuples {
		if err = pipeliner.WaitForRoom(m.Ctx()); err != nil {
			return err
		}
		go func(probe *probeTuple) {
			err := a.lookupProbe(m, teamID, probe)
			pipeliner.CompleteOne(err)
		}(&tuples[i])
	}
	err = pipeliner.Flush(m.Ctx())
	return err
}

func (a *Auditor) auditLocked(m libkb.MetaContext, id keybase1.TeamID, headMerkleSeqno keybase1.Seqno, chain map[keybase1.Seqno]keybase1.LinkID, maxChainSeqno keybase1.Seqno) (err error) {

	defer m.CTrace(fmt.Sprintf("Auditor#auditLocked(%v)", id), func() error { return err })()

	lru := a.getLRU()

	history, err := a.getFromCache(m, id, lru)
	if err != nil {
		return err
	}

	last := lastAudit(history)
	if last != nil && last.MaxChainSeqno == maxChainSeqno {
		m.CDebugf("Short-circuit audit, since there is no new data (@%v)", maxChainSeqno)
		return nil
	}

	root, err := m.G().MerkleClient.FetchRootFromServerByFreshness(m, getAuditParams(m).RootFreshness)
	if err != nil {
		return err
	}

	if history != nil && a.checkRecent(m, history, root) {
		m.CDebugf("cached audit was recent; short-circuiting")
		return nil
	}

	history = makeHistory(history, id)

	newAuditIndex := len(history.Audits)

	err = a.doPreProbes(m, history, newAuditIndex, headMerkleSeqno)
	if err != nil {
		return err
	}

	maxMerkleProbe, err := a.doPostProbes(m, history, newAuditIndex, headMerkleSeqno, *root.Seqno(), chain, maxChainSeqno)
	if err != nil {
		return err
	}
	audit := keybase1.Audit{
		Time:           keybase1.ToTime(m.G().Clock().Now()),
		MaxMerkleSeqno: *root.Seqno(),
		MaxChainSeqno:  maxChainSeqno,
		MaxMerkleProbe: maxMerkleProbe,
	}
	history.Audits = append(history.Audits, audit)
	history.PriorMerkleSeqno = headMerkleSeqno

	err = a.putToCache(m, id, lru, history)
	if err != nil {
		return err
	}
	return nil
}

func (a *Auditor) newLRU(m libkb.MetaContext) {

	a.lruMutex.Lock()
	defer a.lruMutex.Unlock()

	if a.lru != nil {
		a.lru.Purge()
	}

	lru, err := lru.New(getAuditParams(m).LRUSize)
	if err != nil {
		panic(err)
	}
	a.lru = lru
}

func (a *Auditor) OnLogout(m libkb.MetaContext) {
	a.newLRU(m)
}

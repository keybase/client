package teams

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"sort"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/pipeliner"
)

// AuditCurrentVersion is the version that works with this code. Older stored
// versions will be discarded on load from level DB.
const AuditCurrentVersion = keybase1.AuditVersion_V3

var desktopParams = libkb.TeamAuditParams{
	RootFreshness:         5 * time.Minute,
	MerkleMovementTrigger: keybase1.Seqno(10000),
	NumPreProbes:          20,
	NumPostProbes:         20,
	Parallelism:           4,
	LRUSize:               1000,
}

var mobileParamsWifi = libkb.TeamAuditParams{
	RootFreshness:         10 * time.Minute,
	MerkleMovementTrigger: keybase1.Seqno(100000),
	NumPreProbes:          10,
	NumPostProbes:         10,
	Parallelism:           3,
	LRUSize:               500,
}

var mobileParamsNoWifi = libkb.TeamAuditParams{
	RootFreshness:         15 * time.Minute,
	MerkleMovementTrigger: keybase1.Seqno(150000),
	NumPreProbes:          5,
	NumPostProbes:         5,
	Parallelism:           3,
	LRUSize:               500,
}

var devParams = libkb.TeamAuditParams{
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
func getAuditParams(m libkb.MetaContext) libkb.TeamAuditParams {
	if m.G().Env.Test.TeamAuditParams != nil {
		return *m.G().Env.Test.TeamAuditParams
	}
	if m.G().Env.GetRunMode() == libkb.DevelRunMode {
		return devParams
	}
	if libkb.IsMobilePlatform() {
		if m.G().MobileNetState.State().IsLimited() {
			return mobileParamsNoWifi
		}
		return mobileParamsWifi
	}
	return desktopParams
}

type dummyAuditor struct{}

func (d dummyAuditor) AuditTeam(m libkb.MetaContext, id keybase1.TeamID, isPublic bool,
	headMerkleSeqno keybase1.Seqno, chain map[keybase1.Seqno]keybase1.LinkID, maxSeqno keybase1.Seqno,
	justCreated bool) error {
	return nil
}

type Auditor struct {

	// single-flight lock on TeamID
	locktab *libkb.LockTable

	// Map of TeamID -> AuditHistory
	// The LRU is protected by a mutex, because it's swapped out on logout.
	lruMutex sync.Mutex
	lru      *lru.Cache
}

// NewAuditor makes a new auditor
func NewAuditor(g *libkb.GlobalContext) *Auditor {
	ret := &Auditor{
		locktab: libkb.NewLockTable(),
	}
	ret.newLRU(libkb.NewMetaContextBackground(g))
	return ret
}

// NewAuditorAndInstall makes a new Auditor and dangles it
// off of the given GlobalContext.
func NewAuditorAndInstall(g *libkb.GlobalContext) {
	if g.GetEnv().GetDisableTeamAuditor() {
		g.Log.CDebugf(context.TODO(), "Using dummy auditor, audit disabled")
		g.SetTeamAuditor(dummyAuditor{})
	} else {
		a := NewAuditor(g)
		g.SetTeamAuditor(a)
		g.AddLogoutHook(a, "team auditor")
		g.AddDbNukeHook(a, "team auditor")
	}
}

// AuditTeam runs an audit on the links of the given team chain (or team chain suffix).
// The security factor of the audit is a function of the hardcoded parameters above,
// and the amount of time since the last audit. This method should use some sort of
// long-lived cache (via local DB) so that previous audits can be combined with the
// current one. headMerkleSeqno is is the Merkle Root claimed in the head of the team.
// maxSeqno is the maximum seqno of the chainLinks passed; that is, the highest
// Seqno for which chain[s] is defined.
func (a *Auditor) AuditTeam(m libkb.MetaContext, id keybase1.TeamID, isPublic bool, headMerkleSeqno keybase1.Seqno, chain map[keybase1.Seqno]keybase1.LinkID, maxSeqno keybase1.Seqno, justCreated bool) (err error) {

	m = m.WithLogTag("AUDIT")
	defer m.TraceTimed(fmt.Sprintf("Auditor#AuditTeam(%+v)", id), func() error { return err })()

	if id.IsPublic() != isPublic {
		return NewBadPublicError(id, isPublic)
	}

	// Single-flight lock by team ID.
	lock := a.locktab.AcquireOnName(m.Ctx(), m.G(), id.String())
	defer lock.Release(m.Ctx())

	return a.auditLocked(m, id, headMerkleSeqno, chain, maxSeqno, justCreated)
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
		m.Error("Bad type assertion in Auditor#getFromLRU")
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
	if ret.Version != AuditCurrentVersion {
		m.Debug("Discarding audit at version %d (we are supporting %d)", ret.Version, AuditCurrentVersion)
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
		m.Debug("no recent known merkle root in checkRecent")
		return false
	}
	last := lastAudit(history)
	if last == nil {
		m.Debug("no recent audits")
		return false
	}
	diff := *root.Seqno() - last.MaxMerkleSeqno
	if diff >= getAuditParams(m).MerkleMovementTrigger {
		m.Debug("previous merkle audit was %v ago", diff)
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

func maxMerkleProbeInAuditHistory(h *keybase1.AuditHistory) keybase1.Seqno {
	if h == nil {
		return keybase1.Seqno(0)
	}

	// The audits at the back of the list are the most recent, but some
	// of these audits might have been "nil" audits that didn't actually probe
	// any new paths (see comment in doPostProbes about how you can short-circuit
	// doing probes). So keep going backwards until we hit the first non-0
	// maxMerkleProbe. Remember, maxMerkleProbe is the maximum merkle seqno
	// probed in the last audit.
	for i := len(h.Audits) - 1; i >= 0; i-- {
		if mmp := h.Audits[i].MaxMerkleProbe; mmp >= keybase1.Seqno(0) {
			return mmp
		}
	}
	return keybase1.Seqno(0)
}

func makeHistory(history *keybase1.AuditHistory, id keybase1.TeamID) *keybase1.AuditHistory {
	if history == nil {
		return &keybase1.AuditHistory{
			ID:         id,
			Public:     id.IsPublic(),
			Version:    AuditCurrentVersion,
			PreProbes:  make(map[keybase1.Seqno]keybase1.Probe),
			PostProbes: make(map[keybase1.Seqno]keybase1.Probe),
			Tails:      make(map[keybase1.Seqno]keybase1.LinkID),
		}
	}
	ret := history.DeepCopy()
	return &ret
}

// doPostProbes probes the sequence timeline _after_ the team was created.
func (a *Auditor) doPostProbes(m libkb.MetaContext, history *keybase1.AuditHistory, probeID int, headMerkleSeqno keybase1.Seqno, latestMerkleSeqno keybase1.Seqno, chain map[keybase1.Seqno]keybase1.LinkID, maxChainSeqno keybase1.Seqno) (numProbes int, maxMerkleProbe keybase1.Seqno, err error) {
	defer m.Trace("Auditor#doPostProbes", func() error { return err })()

	var low keybase1.Seqno
	lastMaxMerkleProbe := maxMerkleProbeInAuditHistory(history)
	var prev *probeTuple
	if lastMaxMerkleProbe == keybase1.Seqno(0) {
		low = headMerkleSeqno
	} else {
		low = lastMaxMerkleProbe
		probe, ok := history.PostProbes[lastMaxMerkleProbe]
		if !ok {
			// This might happen if leveldb was corrupted, or if we had a bug of some sort.
			// But it makes sense not error out of the audit process.
			m.Warning("previous audit pointed to a bogus probe (seqno=%d); starting from scratch at head Merkle seqno=%d", lastMaxMerkleProbe, headMerkleSeqno)
			low = headMerkleSeqno
		} else {
			prev = &probeTuple{
				merkle: lastMaxMerkleProbe,
				team:   probe.TeamSeqno,
				// leave linkID nil, it's not needed...
			}
		}
	}

	// Probe only after the checkpoint. Merkle roots before the checkpoint aren't examined and are
	// trusted to be legit, being buried far enough in the past. Therefore probing is not necessary.
	first := m.G().MerkleClient.FirstExaminableHistoricalRoot(m)

	if first == nil {
		return 0, keybase1.Seqno(0), NewAuditError("cannot find a first modern merkle sequence")
	}

	if low < *first {
		m.Debug("bumping low sequence number to last merkle checkpoint: %s", *first)
		low = *first
	}

	probeTuples, err := a.computeProbes(m, history.ID, history.PostProbes, probeID, low, latestMerkleSeqno, 0, getAuditParams(m).NumPostProbes)
	if err != nil {
		return 0, keybase1.Seqno(0), err
	}
	if len(probeTuples) == 0 {
		m.Debug("No probe tuples, so bailing")
		return 0, keybase1.Seqno(0), nil
	}

	ret := 0

	for _, tuple := range probeTuples {
		m.Debug("postProbe: checking probe at %+v", tuple)

		// Note that we might see tuple.team == 0 in a legit case. There is a race here. If seqno=1
		// of team foo was made when the last merkle seqno was 2000, let's say, then for merkle seqnos
		// 2000-2001, the team foo might not be in the tree. So we'd expect the tuple.team to be 0
		// in that (unlikely) case. So we don't check the validity of the linkID in that case
		// (since it doesn't exist). However, we still do check that tuple.team's are non-decreasing,
		// so this 0 value is checked below (see comment).
		if tuple.team > keybase1.Seqno(0) {
			expectedLinkID, ok := chain[tuple.team]

			// It could be that our view of the chain is stale, and that the merkle tree is advertising
			// chain links that we've never fetched. That's OK, we don't need to error out of the
			// auditor. But if we're missing links before maxChainSeqno, then we have big problems.
			if !ok {
				if tuple.team < maxChainSeqno {
					return 0, keybase1.Seqno(0), NewAuditError("team chain didn't contain seqno=%d even though we expected links through %d", tuple.team, maxChainSeqno)
				}
				continue
			}
			if !expectedLinkID.Eq(tuple.linkID) {
				return 0, keybase1.Seqno(0), NewAuditError("team chain linkID mismatch at %d: wanted %s but got %s via merkle seqno %d", tuple.team, expectedLinkID, tuple.linkID, tuple.merkle)
			}
		}
		ret++
		history.PostProbes[tuple.merkle] = keybase1.Probe{Index: probeID, TeamSeqno: tuple.team}

		// This condition is the key ordering condition. It is still checked in the case of the race
		// condition at tuple.team==0 mentioned just above.
		if prev != nil && prev.team > tuple.team {
			return 0, keybase1.Seqno(0), NewAuditError("team chain unexpected jump: %d > %d via merkle seqno %d", prev.team, tuple.team, tuple.merkle)
		}
		if tuple.merkle > maxMerkleProbe {
			maxMerkleProbe = tuple.merkle
		}
		prev = &tuple
	}
	return ret, maxMerkleProbe, nil
}

// doPreProbes probabilistically checks that no team occupied the slot before the team
// in question was created. It selects probes from before the team was created. Each
// probed leaf must not be occupied.
func (a *Auditor) doPreProbes(m libkb.MetaContext, history *keybase1.AuditHistory, probeID int, headMerkleSeqno keybase1.Seqno) (numProbes int, err error) {
	defer m.Trace("Auditor#doPreProbes", func() error { return err })()

	first := m.G().MerkleClient.FirstExaminableHistoricalRoot(m)
	if first == nil {
		return 0, NewAuditError("cannot find a first modern merkle sequence")
	}

	probeTuples, err := a.computeProbes(m, history.ID, history.PreProbes, probeID, *first, headMerkleSeqno, len(history.PreProbes), getAuditParams(m).NumPreProbes)
	if err != nil {
		return 0, err
	}
	if len(probeTuples) == 0 {
		m.Debug("No probe pairs, so bailing")
		return 0, nil
	}
	for _, tuple := range probeTuples {
		m.Debug("preProbe: checking probe at merkle %d", tuple.merkle)
		if tuple.team != keybase1.Seqno(0) || !tuple.linkID.IsNil() {
			return 0, NewAuditError("merkle root at %v should have been nil for %v; got %s/%d",
				tuple.merkle, history.ID, tuple.linkID, tuple.team)
		}
	}
	return len(probeTuples), nil
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

func (a *Auditor) scheduleProbes(m libkb.MetaContext, previousProbes map[keybase1.Seqno]keybase1.Probe, probeID int, left keybase1.Seqno, right keybase1.Seqno, probesInRange int, n int) (ret []probeTuple, err error) {
	defer m.Trace(fmt.Sprintf("Auditor#scheduleProbes(left=%d,right=%d)", left, right), func() error { return err })()
	if probesInRange > n {
		m.Debug("no more probes needed; did %d, wanted %d", probesInRange, n)
		return nil, nil
	}
	rng := right - left + 1
	if int(rng) <= probesInRange {
		m.Debug("no more probes needed; range was only %d, and we did %d", rng, probesInRange)
		return nil, nil
	}
	currentProbes := make(map[keybase1.Seqno]bool)
	for i := 0; i < n; i++ {
		x, err := randSeqno(left, right)
		if err != nil {
			return nil, err
		}
		if _, found := previousProbes[x]; found {
			continue
		}
		if currentProbes[x] {
			continue
		}
		ret = append(ret, probeTuple{merkle: x})
		currentProbes[x] = true
	}
	sort.SliceStable(ret, func(i, j int) bool {
		return ret[i].merkle < ret[j].merkle
	})
	m.Debug("scheduled probes: %+v", ret)
	return ret, nil
}

func (a *Auditor) lookupProbe(m libkb.MetaContext, teamID keybase1.TeamID, probe *probeTuple) (err error) {
	defer m.Trace(fmt.Sprintf("Auditor#lookupProbe(%v,%v)", teamID, *probe), func() error { return err })()
	leaf, _, err := m.G().MerkleClient.LookupLeafAtSeqnoForAudit(m, teamID.AsUserOrTeam(), probe.merkle)
	if err != nil {
		return err
	}
	if leaf == nil || leaf.Private == nil {
		m.Debug("nil leaf at %v/%v", teamID, probe.merkle)
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

func (a *Auditor) checkTail(m libkb.MetaContext, history *keybase1.AuditHistory, lastAudit keybase1.Audit, chain map[keybase1.Seqno]keybase1.LinkID, maxChainSeqno keybase1.Seqno) (err error) {
	link, ok := chain[lastAudit.MaxChainSeqno]
	if !ok || link.IsNil() {
		return NewAuditError("last audit ended at %d, but wasn't found in new chain", lastAudit.MaxChainSeqno)
	}
	tail, ok := history.Tails[lastAudit.MaxChainSeqno]
	if !ok || tail.IsNil() {
		return NewAuditError("previous chain tail at %d did not have a linkID", lastAudit.MaxChainSeqno)
	}
	if !link.Eq(tail) {
		return NewAuditError("bad chain tail mismatch (%s != %s) at chain link %d", link, tail, lastAudit.MaxChainSeqno)
	}
	link, ok = chain[maxChainSeqno]
	if !ok || link.IsNil() {
		return NewAuditError("given chain didn't have a link at %d, but it was expected", maxChainSeqno)
	}
	return nil
}

func (a *Auditor) skipAuditSinceJustCreated(m libkb.MetaContext, id keybase1.TeamID, headMerkleSeqno keybase1.Seqno) (err error) {
	now := m.G().Clock().Now()
	until := now.Add(getAuditParams(m).RootFreshness)
	m.Debug("team (%s) was just created; skipping the audit until %v", id, until)
	history := makeHistory(nil, id)
	history.SkipUntil = keybase1.ToTime(until)
	history.PriorMerkleSeqno = headMerkleSeqno
	lru := a.getLRU()
	return a.putToCache(m, id, lru, history)
}

func (a *Auditor) holdOffSinceJustCreated(m libkb.MetaContext, history *keybase1.AuditHistory) (res bool, err error) {
	if history == nil || history.SkipUntil == keybase1.Time(0) {
		return false, nil
	}
	now := m.G().Clock().Now()
	until := keybase1.FromTime(history.SkipUntil)
	if now.After(until) {
		return false, nil
	}
	m.Debug("holding off on subsequent audits since the team (%s) was just created (until %v)", history.ID, until)
	return true, nil
}

func (a *Auditor) auditLocked(m libkb.MetaContext, id keybase1.TeamID, headMerkleSeqno keybase1.Seqno, chain map[keybase1.Seqno]keybase1.LinkID, maxChainSeqno keybase1.Seqno, justCreated bool) (err error) {

	defer m.Trace(fmt.Sprintf("Auditor#auditLocked(%v)", id), func() error { return err })()

	lru := a.getLRU()

	if justCreated {
		return a.skipAuditSinceJustCreated(m, id, headMerkleSeqno)
	}

	history, err := a.getFromCache(m, id, lru)
	if err != nil {
		return err
	}

	holdOff, err := a.holdOffSinceJustCreated(m, history)
	if err != nil {
		return err
	}
	if holdOff {
		return nil
	}

	last := lastAudit(history)

	// It's possible that we're bouncing back and forth between the Fast and Slow
	// loader. Therefore, it might have been that we previous audited up to chainlink
	// 20, and now we're seeing an audit only for link 18 (if one of them was stale).
	// That's fine, just make sure to short-circuit as long as we've audited past
	// the given maxChainSeqno.
	if last != nil && last.MaxChainSeqno >= maxChainSeqno {
		m.Debug("Short-circuit audit, since there is no new data (@%v <= %v)", maxChainSeqno, last.MaxChainSeqno)
		return nil
	}

	// Check that the last time we ran an audit is a subchain of the new links
	// we got down. It suffices to check that the last link in that chain
	// appears in the given chain with the right link ID.
	if last != nil {
		err = a.checkTail(m, history, *last, chain, maxChainSeqno)
		if err != nil {
			return err
		}
	}

	root, err := m.G().MerkleClient.FetchRootFromServer(m, getAuditParams(m).RootFreshness)
	if err != nil {
		return err
	}

	if history != nil && a.checkRecent(m, history, root) {
		m.Debug("cached audit was recent; short-circuiting")
		return nil
	}

	history = makeHistory(history, id)

	newAuditIndex := len(history.Audits)

	var numPreProbes, numPostProbes int

	numPreProbes, err = a.doPreProbes(m, history, newAuditIndex, headMerkleSeqno)
	if err != nil {
		return err
	}

	numPostProbes, maxMerkleProbe, err := a.doPostProbes(m, history, newAuditIndex, headMerkleSeqno, *root.Seqno(), chain, maxChainSeqno)
	if err != nil {
		return err
	}

	if numPostProbes+numPreProbes == 0 {
		m.Debug("No new probes, not writing to cache")
		return nil
	}

	m.Debug("Probes completed; numPre=%d, numPost=%d", numPreProbes, numPostProbes)

	audit := keybase1.Audit{
		Time:           keybase1.ToTime(m.G().Clock().Now()),
		MaxMerkleSeqno: *root.Seqno(),
		MaxChainSeqno:  maxChainSeqno,
		// Note that the MaxMerkleProbe can be 0 in the case that there were
		// pre-probes, but no post-probes.
		MaxMerkleProbe: maxMerkleProbe,
	}
	history.Audits = append(history.Audits, audit)
	history.PriorMerkleSeqno = headMerkleSeqno
	history.Tails[maxChainSeqno] = chain[maxChainSeqno]

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

func (a *Auditor) OnLogout(mctx libkb.MetaContext) error {
	a.newLRU(mctx)
	return nil
}

func (a *Auditor) OnDbNuke(mctx libkb.MetaContext) error {
	a.newLRU(mctx)
	return nil
}

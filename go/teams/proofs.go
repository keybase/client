package teams

import (
	"fmt"
	"sort"

	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// newProofTerm creates a new proof term.
// `lm` can be nil (it is for teams since SetTeamLinkMap is used)
func newProofTerm(i keybase1.UserOrTeamID, s keybase1.SignatureMetadata, lm linkMapT) proofTerm {
	return proofTerm{leafID: i, sigMeta: s, linkMap: lm}
}

type linkMapT map[keybase1.Seqno]keybase1.LinkID

type proofTerm struct {
	leafID  keybase1.UserOrTeamID
	sigMeta keybase1.SignatureMetadata
	linkMap linkMapT
}

func (t *proofTerm) shortForm() string {
	return fmt.Sprintf("%v@%v", t.sigMeta.SigChainLocation.Seqno, t.leafID)

}

type proofTermBookends struct {
	left  proofTerm
	right *proofTerm
}

type proof struct {
	a      proofTerm
	b      proofTerm
	reason string
}

func (p *proof) shortForm() string {
	return fmt.Sprintf("%v --> %v '%v'", p.a.shortForm(), p.b.shortForm(), p.reason)
}

type proofIndex struct {
	a keybase1.UserOrTeamID
	b keybase1.UserOrTeamID
}

func (t proofTerm) seqno() keybase1.Seqno { return t.sigMeta.SigChainLocation.Seqno }
func (t proofTerm) isPublic() bool {
	return t.sigMeta.SigChainLocation.SeqType == keybase1.SeqType_PUBLIC
}

// comparison method only valid if `t` and `u` are known to be on the same chain
func (t proofTerm) lessThanOrEqual(u proofTerm) bool {
	return t.seqno() <= u.seqno()
}

// comparison method only valid if `t` and `u` are known to be on the same chain
func (t proofTerm) equal(u proofTerm) bool {
	return t.seqno() == u.seqno()
}

// comparison method only valid if `t` and `u` are known to be on the same chain
func (t proofTerm) max(u proofTerm) proofTerm {
	if t.lessThanOrEqual(u) {
		return u
	}
	return t
}

// comparison method only valid if `t` and `u` are known to be on the same chain
func (t proofTerm) min(u proofTerm) proofTerm {
	if t.lessThanOrEqual(u) {
		return t
	}
	return u
}

func newProofIndex(a keybase1.UserOrTeamID, b keybase1.UserOrTeamID) proofIndex {
	return proofIndex{b, a}
}

type proofSetT struct {
	libkb.Contextified
	proofs       map[proofIndex][]proof
	teamLinkMaps map[keybase1.TeamID]linkMapT
}

func newProofSet(g *libkb.GlobalContext) *proofSetT {
	return &proofSetT{
		Contextified: libkb.NewContextified(g),
		proofs:       make(map[proofIndex][]proof),
		teamLinkMaps: make(map[keybase1.TeamID]linkMapT),
	}
}

// AddNeededHappensBeforeProof adds a new needed proof to the proof set. The
// proof is that `a` happened before `b`.  If there are other proofs in the proof set
// that prove the same thing, then we can tighten those proofs with a and b if
// it makes sense.  For instance, if there is an existing proof that c<d,
// but we know that c<a and b<d, then it suffices to replace c<d with a<b as
// the needed proof. Each proof in the proof set in the end will correspond
// to a merkle tree lookup, so it makes sense to be stingy. Return the modified
// proof set with the new proofs needed, but the original argument p will
// be mutated.
func (p *proofSetT) AddNeededHappensBeforeProof(ctx context.Context, a proofTerm, b proofTerm, reason string) {

	var action string
	defer func() {
		if action != "discard-easy" && !ShouldSuppressLogging(ctx) {
			p.G().Log.CDebugf(ctx, "proofSet add(%v --> %v) [%v] '%v'", a.shortForm(), b.shortForm(), action, reason)
		}
	}()

	idx := newProofIndex(a.leafID, b.leafID)

	if idx.a.Equal(idx.b) {
		// If both terms are on the same chain
		if a.lessThanOrEqual(b) {
			// The proof is self-evident.
			// Discard it.
			action = "discard-easy"
			return
		}
		// The proof is self-evident FALSE.
		// Add it and return immediately so the rest of this function doesn't have to trip over it.
		// It should be failed later by the checker.
		action = "added-easy-false"
		p.proofs[idx] = append(p.proofs[idx], proof{a, b, reason})
		return
	}

	set := p.proofs[idx]
	for i := len(set) - 1; i >= 0; i-- {
		existing := set[i]
		if existing.a.lessThanOrEqual(a) && b.lessThanOrEqual(existing.b) {
			// If the new proof is surrounded by the old proof.
			existing.a = existing.a.max(a)
			existing.b = existing.b.min(b)
			set[i] = existing
			action = "collapsed"
			return
		}
		if existing.a.equal(a) && existing.b.lessThanOrEqual(b) {
			// If the new proof is the same on the left and weaker on the right.
			// Discard the new proof, as it is implied by the existing one.
			action = "discard-weak"
			return
		}
	}
	action = "added"
	p.proofs[idx] = append(p.proofs[idx], proof{a, b, reason})
}

// Set the latest link map for the team
func (p *proofSetT) SetTeamLinkMap(ctx context.Context, teamID keybase1.TeamID, linkMap linkMapT) {
	p.teamLinkMaps[teamID] = linkMap
}

func (p *proofSetT) AllProofs() []proof {
	var ret []proof
	for _, v := range p.proofs {
		ret = append(ret, v...)
	}
	sort.Slice(ret, func(i, j int) bool {
		cmp := ret[i].a.leafID.Compare(ret[j].a.leafID)
		if cmp < 0 {
			return true
		}
		if cmp > 0 {
			return false
		}
		cmp = ret[i].b.leafID.Compare(ret[j].b.leafID)
		if cmp < 0 {
			return true
		}
		if cmp > 0 {
			return false
		}
		cs := ret[i].a.sigMeta.SigChainLocation.Seqno - ret[j].a.sigMeta.SigChainLocation.Seqno
		if cs < 0 {
			return true
		}
		if cs > 0 {
			return false
		}
		cs = ret[i].b.sigMeta.SigChainLocation.Seqno - ret[j].b.sigMeta.SigChainLocation.Seqno
		if cs < 0 {
			return true
		}
		return false
	})
	return ret
}

// lookupMerkleTreeChain loads the path up to the merkle tree and back down that corresponds
// to this proof. It will contact the API server.  Returns the sigchain tail on success.
func (p proof) lookupMerkleTreeChain(ctx context.Context, world LoaderContext) (ret *libkb.MerkleTriple, err error) {
	return world.merkleLookupTripleInPast(ctx, p.a.isPublic(), p.a.leafID, p.b.sigMeta.PrevMerkleRootSigned)
}

// check a single proof. Call to the merkle API endpoint, and then ensure that the
// data that comes back fits the proof and previously checked sigchain links.
func (p proof) check(ctx context.Context, g *libkb.GlobalContext, world LoaderContext, proofSet *proofSetT) (err error) {
	defer func() {
		g.Log.CDebugf(ctx, "TeamLoader proofSet check1(%v) -> %v", p.shortForm(), err)
	}()

	triple, err := p.lookupMerkleTreeChain(ctx, world)
	if err != nil {
		return err
	}

	// laterSeqno is the tail of chain A at the time when B was signed
	// earlierSeqno is the tail of chain A at the time when A was signed
	laterSeqno := triple.Seqno
	earlierSeqno := p.a.sigMeta.SigChainLocation.Seqno
	if earlierSeqno > laterSeqno {
		return NewProofError(p, fmt.Sprintf("seqno %d > %d", earlierSeqno, laterSeqno))
	}

	linkID, err := p.findLink(ctx, g, world, p.a.leafID, laterSeqno, p.a.linkMap, proofSet)
	if err != nil {
		return err
	}

	if !triple.LinkID.Export().Eq(linkID) {
		g.Log.CDebugf(ctx, "proof error: %s", spew.Sdump(p))
		return NewProofError(p, fmt.Sprintf("hash mismatch: %s != %s", triple.LinkID, linkID))
	}
	return nil
}

// Find the LinkID for the leaf at the seqno.
func (p proof) findLink(ctx context.Context, g *libkb.GlobalContext, world LoaderContext, leafID keybase1.UserOrTeamID, seqno keybase1.Seqno, firstLinkMap linkMapT, proofSet *proofSetT) (linkID keybase1.LinkID, err error) {
	lm := firstLinkMap

	if leafID.IsTeamOrSubteam() {
		// Pull in the latest link map, instead of the one from the proof object.
		tid := leafID.AsTeamOrBust()
		lm2, ok := proofSet.teamLinkMaps[tid]
		if ok {
			lm = lm2
		}
	}
	if lm == nil {
		return linkID, NewProofError(p, "nil link map")
	}

	linkID, ok := lm[seqno]
	if ok {
		return linkID, nil
	}

	// We loaded this user originally to get a sigchain as fresh as a certain key provisioning.
	// In this scenario, we might need a fresher version, so force a poll all the way through
	// the server, and then try again. If we fail the second time, we a force repoll, then
	// we're toast.
	if leafID.IsUser() {
		g.Log.CDebugf(ctx, "proof#findLink: missed load for %s at %d; trying a force repoll", leafID.String(), seqno)
		lm, err := world.forceLinkMapRefreshForUser(ctx, leafID.AsUserOrBust())
		if err != nil {
			return linkID, err
		}
		linkID, ok = lm[seqno]
	}

	if !ok {
		return linkID, NewProofError(p, fmt.Sprintf("no linkID for seqno %d", seqno))
	}
	return linkID, nil
}

func (p *proofSetT) checkRequired() bool {
	return len(p.proofs) > 0
}

// check the entire proof set, failing if any one proof fails.
func (p *proofSetT) check(ctx context.Context, world LoaderContext, parallel bool) (err error) {
	defer p.G().CTrace(ctx, "TeamLoader proofSet check", func() error { return err })()

	if parallel {
		return p.checkParallel(ctx, world)
	}

	var total int
	for _, v := range p.proofs {
		total += len(v)
	}

	var i int
	for _, v := range p.proofs {
		for _, proof := range v {
			p.G().Log.CDebugf(ctx, "TeamLoader proofSet check [%v / %v]", i, total)
			err = proof.check(ctx, p.G(), world, p)
			if err != nil {
				return err
			}
			i++
		}
	}
	return nil
}

// check the entire proof set, failing if any one proof fails. (parallel version)
func (p *proofSetT) checkParallel(ctx context.Context, world LoaderContext) (err error) {

	var total int
	for _, v := range p.proofs {
		total += len(v)
	}
	p.G().Log.CDebugf(ctx, "TeamLoader proofSet check parallel [%v]", total)

	queue := make(chan proof)
	go func() {
		for _, v := range p.proofs {
			for _, proof := range v {
				queue <- proof
			}
		}
		close(queue)
	}()

	group, ctx := errgroup.WithContext(libkb.CopyTagsToBackground(ctx))
	const pipeline = 20
	for i := 0; i < pipeline; i++ {
		group.Go(func() error {
			for {
				select {
				case <-ctx.Done():
					return ctx.Err()
				case proof, ok := <-queue:
					if !ok {
						return nil
					}
					err = proof.check(ctx, p.G(), world, p)
					if err != nil {
						return err
					}
				}
			}
		})
	}

	return group.Wait()
}

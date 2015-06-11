package libkb

import (
	keybase1 "github.com/keybase/client/protocol/go"
)

type IdentifyState struct {
	res   *IdentifyOutcome
	u     *User
	track *TrackLookup
}

func NewIdentifyState(res *IdentifyOutcome, u *User) IdentifyState {
	return IdentifyState{res: res, u: u}
}

func (s *IdentifyState) CreateTrackLookup(t *TrackChainLink) {
	s.track = NewTrackLookup(t)
}

func (s *IdentifyState) TrackLookup() *TrackLookup {
	return s.track
}

func (s *IdentifyState) ComputeDeletedProofs() {
	if s.track == nil {
		return
	}

	found := s.res.TrackSet()
	tracked := s.track.set

	// These are the proofs that we previously tracked that we
	// didn't observe in the current profile
	diff := (*tracked).Subtract(*found)

	for _, e := range diff {
		// If the proofs in the difference are for GOOD proofs,
		// the we have a problem.  Mark the proof as "DELETED"
		if e.GetProofState() == keybase1.ProofState_OK {
			s.res.Deleted = append(s.res.Deleted, TrackDiffDeleted{e})
		}
	}
}

func (s *IdentifyState) InitResultList() {
	idt := s.u.IDTable()
	if idt == nil {
		return
	}
	activeProofs := idt.remoteProofLinks.Active()
	s.res.ProofChecks = make([]*LinkCheckResult, len(activeProofs))
	for i, p := range activeProofs {
		s.res.ProofChecks[i] = &LinkCheckResult{link: p, trackedProofState: keybase1.ProofState_NONE, position: i}
	}
}

func (s *IdentifyState) ComputeTrackDiffs() {
	if s.track == nil {
		return
	}

	G.Log.Debug("| with tracking %v", s.track.set)
	for _, c := range s.res.ProofChecks {
		c.diff = c.link.ComputeTrackDiff(s.track)
		c.trackedProofState = s.track.GetProofState(c.link.ToIdString())
	}
}

func (s *IdentifyState) ComputeKeyDiffs(dhook func(keybase1.FOKID, *keybase1.TrackDiff)) {
	mapify := func(v []FOKID) map[PgpFingerprint]bool {
		ret := make(map[PgpFingerprint]bool)
		for _, f := range v {
			ret[*f.Fp] = true
		}
		return ret
	}

	display := func(fokid FOKID, diff TrackDiff) {
		dhook(fokid.Export(), ExportTrackDiff(diff))
	}

	found := s.u.GetActivePgpFOKIDs(true)
	found_map := mapify(found)
	var tracked []FOKID
	if s.track != nil {
		tracked = s.track.GetTrackedPGPFOKIDs()
	}
	tracked_map := mapify(tracked)

	for _, fp := range found {
		var diff TrackDiff
		if s.track != nil && !tracked_map[*fp.Fp] {
			diff = TrackDiffNew{}
			s.res.KeyDiffs = append(s.res.KeyDiffs, diff)
		} else {
			diff = TrackDiffNone{}
		}
		display(fp, diff)
	}

	for _, fp := range tracked {
		if !found_map[*fp.Fp] {
			diff := TrackDiffDeleted{fp.Fp}
			s.res.KeyDiffs = append(s.res.KeyDiffs, diff)
			display(fp, diff)
		}
	}
}

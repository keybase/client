package libkb

import (
	keybase_1 "github.com/keybase/client/protocol/go"
)

type IdentifyState struct {
	res   *IdentifyOutcome
	u     *User
	Track *TrackLookup
}

func NewIdentifyState(res *IdentifyOutcome, u *User) IdentifyState {
	return IdentifyState{res: res, u: u}
}

func (s *IdentifyState) ComputeDeletedProofs() {
	if s.Track == nil {
		return
	}
	found := s.u.IdTable().MakeTrackSet()
	tracked := s.Track.set

	// These are the proofs that we previously tracked that we
	// didn't observe in the current profile
	diff := (*tracked).Subtract(*found)

	for _, e := range diff {
		// If the proofs in the difference are for GOOD proofs,
		// the we have a problem.  Mark the proof as "DELETED"
		if e.GetProofState() == PROOF_STATE_OK {
			s.res.Deleted = append(s.res.Deleted, TrackDiffDeleted{e})
		}
	}
}

func (s *IdentifyState) InitResultList() {
	idt := s.u.IdTable()
	if idt == nil {
		return
	}
	l := len(idt.activeProofs)
	s.res.ProofChecks = make([]*LinkCheckResult, l)
	for i, p := range idt.activeProofs {
		s.res.ProofChecks[i] = &LinkCheckResult{link: p, trackedProofState: PROOF_STATE_NONE, position: i}
	}
}

func (s *IdentifyState) ComputeTrackDiffs() {
	if s.Track != nil {
		G.Log.Debug("| with tracking %v", s.Track.set)
		for _, c := range s.res.ProofChecks {
			c.diff = c.link.ComputeTrackDiff(s.Track)
			c.trackedProofState = s.Track.GetProofState(c.link)
		}
	}
}

func (s *IdentifyState) ComputeKeyDiffs(dhook func(keybase_1.FOKID, *keybase_1.TrackDiff)) {

	mapify := func(v []PgpFingerprint) map[PgpFingerprint]bool {
		ret := make(map[PgpFingerprint]bool)
		for _, f := range v {
			ret[f] = true
		}
		return ret
	}

	display := func(fp PgpFingerprint, diff TrackDiff) {
		fokid := FOKID{Fp: &fp}
		dhook(fokid.Export(), ExportTrackDiff(diff))
	}

	found := s.u.GetActivePgpFingerprints(true)
	found_map := mapify(found)
	var tracked []PgpFingerprint
	if s.Track != nil {
		tracked = s.Track.GetTrackedPGPFingerprints()
	}
	tracked_map := mapify(tracked)

	for _, fp := range found {
		var diff TrackDiff
		if s.Track != nil && !tracked_map[fp] {
			diff = TrackDiffNew{}
			s.res.KeyDiffs = append(s.res.KeyDiffs, diff)
		} else {
			diff = TrackDiffNone{}
		}
		display(fp, diff)
	}

	for _, fp := range tracked {
		if !found_map[fp] {
			diff := TrackDiffDeleted{fp}
			s.res.KeyDiffs = append(s.res.KeyDiffs, diff)
			display(fp, diff)
		}
	}
}

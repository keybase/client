package libkb

import keybase1 "github.com/keybase/client/protocol/go"

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

func (s *IdentifyState) HasPreviousTrack() bool {
	return s.track != nil
}

func (s *IdentifyState) ComputeRevokedProofs() {
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
		// the we have a problem.  Mark the proof as "REVOKED"
		if e.GetProofState() == keybase1.ProofState_OK {
			s.res.Revoked = append(s.res.Revoked, TrackDiffRevoked{e})
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
		c.trackedProofState = s.track.GetProofState(c.link.ToIDString())
	}
}

func (s *IdentifyState) ComputeKeyDiffs(dhook func(keybase1.IdentifyKey)) {
	mapify := func(v []PGPFingerprint) map[PGPFingerprint]bool {
		ret := make(map[PGPFingerprint]bool)
		for _, k := range v {
			ret[k] = true
		}
		return ret
	}

	display := func(fp PGPFingerprint, diff TrackDiff) {
		k := keybase1.IdentifyKey{
			TrackDiff: ExportTrackDiff(diff),
		}
		k.PGPFingerprint = fp[:]
		dhook(k)
	}

	found := s.u.GetActivePGPFingerprints(true)
	foundMap := mapify(found)
	var tracked []PGPFingerprint
	if s.track != nil {
		tracked = s.track.GetTrackedPGPFingerprints()
	}
	trackedMap := mapify(tracked)

	for _, fp := range found {
		var diff TrackDiff
		if s.track != nil && !trackedMap[fp] {
			diff = TrackDiffNew{}
			s.res.KeyDiffs = append(s.res.KeyDiffs, diff)
		} else if s.track != nil {
			diff = TrackDiffNone{}
		}
		display(fp, diff)
	}

	for _, fp := range tracked {
		if !foundMap[fp] {
			diff := TrackDiffRevoked{fp}
			s.res.KeyDiffs = append(s.res.KeyDiffs, diff)
			display(fp, diff)
		}
	}
}

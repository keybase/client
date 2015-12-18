// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import keybase1 "github.com/keybase/client/go/protocol"

type IdentifyState struct {
	res   *IdentifyOutcome
	u     *User
	track *TrackLookup
}

func NewIdentifyState(res *IdentifyOutcome, u *User) IdentifyState {
	if res == nil {
		res = &IdentifyOutcome{}
	}
	return IdentifyState{res: res, u: u}
}

func (s *IdentifyState) SetTrackLookup(t *TrackChainLink) {
	s.track = NewTrackLookup(t)
	if s.res != nil {
		s.res.TrackUsed = s.track
	}
}

func (s *IdentifyState) TrackLookup() *TrackLookup {
	return s.track
}

func (s *IdentifyState) HasPreviousTrack() bool {
	return s.track != nil
}

func (s *IdentifyState) Result() *IdentifyOutcome {
	return s.res
}

func (s *IdentifyState) computeRevokedProofs() {
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

func (s *IdentifyState) initResultList() {
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

func (s *IdentifyState) computeTrackDiffs() {
	if s.track == nil {
		return
	}

	G.Log.Debug("| with tracking %v", s.track.set)
	for _, c := range s.res.ProofChecks {
		c.diff = c.link.ComputeTrackDiff(s.track)
		c.trackedProofState = s.track.GetProofState(c.link.ToIDString())
	}
}

func (s *IdentifyState) Precompute(dhook func(keybase1.IdentifyKey)) {
	s.computeKeyDiffs(dhook)
	s.initResultList()
	s.computeTrackDiffs()
	s.computeRevokedProofs()
}

func (s *IdentifyState) computeKeyDiffs(dhook func(keybase1.IdentifyKey)) {
	mapify := func(v []keybase1.KID) map[keybase1.KID]bool {
		ret := make(map[keybase1.KID]bool)
		for _, k := range v {
			ret[k] = true
		}
		return ret
	}

	display := func(kid keybase1.KID, diff TrackDiff) {
		k := keybase1.IdentifyKey{
			TrackDiff: ExportTrackDiff(diff),
		}
		k.KID = kid
		fp := s.u.GetKeyFamily().kid2pgp[kid]
		k.PGPFingerprint = fp[:]
		dhook(k)
	}

	// first check the eldest key
	observedEldest := s.u.GetEldestKID()
	if s.track != nil {
		trackedEldest := s.track.GetEldestKID()
		if observedEldest.NotEqual(trackedEldest) {
			diff := TrackDiffNewEldest{tracked: trackedEldest, observed: observedEldest}
			s.res.KeyDiffs = append(s.res.KeyDiffs, diff)
			display(observedEldest, diff)
		}
	}

	found := s.u.GetActivePGPKIDs(true)
	foundMap := mapify(found)
	var tracked []keybase1.KID
	if s.track != nil {
		for _, trackedKey := range s.track.GetTrackedKeys() {
			tracked = append(tracked, trackedKey.KID)
		}
	}
	trackedMap := mapify(tracked)

	for _, kid := range found {
		var diff TrackDiff
		if s.track != nil && !trackedMap[kid] {
			diff = TrackDiffNew{}
			s.res.KeyDiffs = append(s.res.KeyDiffs, diff)
		} else if s.track != nil {
			diff = TrackDiffNone{}
		}
		display(kid, diff)
	}

	for _, kid := range tracked {
		if !foundMap[kid] {
			fp := s.u.GetKeyFamily().kid2pgp[kid]
			diff := TrackDiffRevoked{fp}
			s.res.KeyDiffs = append(s.res.KeyDiffs, diff)
			display(kid, diff)
		}
	}
}

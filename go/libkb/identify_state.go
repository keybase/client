// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"github.com/keybase/client/go/gregor"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type IdentifyState struct {
	res      *IdentifyOutcome
	u        *User
	track    *TrackLookup
	tmpTrack *TrackLookup
}

func NewIdentifyState(res *IdentifyOutcome, u *User) IdentifyState {
	if res == nil {
		res = NewIdentifyOutcomeWithUsername(u.GetNormalizedName())
	}
	return IdentifyState{res: res, u: u}
}

func NewIdentifyStateWithGregorItem(item gregor.Item, u *User) IdentifyState {
	res := NewIdentifyOutcomeWithUsername(u.GetNormalizedName())
	res.ResponsibleGregorItem = item
	return IdentifyState{res: res, u: u}
}

func (s *IdentifyState) SetTrackLookup(t *TrackChainLink) {
	s.track = NewTrackLookup(t)
	if s.res != nil {
		s.res.TrackUsed = s.track
	}
}

func (s *IdentifyState) SetTmpTrackLookup(t *TrackChainLink) {
	s.tmpTrack = NewTrackLookup(t)
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

func (s *IdentifyState) TmpTrackLookup() *TrackLookup {
	return s.tmpTrack
}

func (s *IdentifyState) computeRevokedProofs() {
	if s.track == nil {
		return
	}

	found := s.res.TrackSet()

	tracked := s.track.set

	// These are the proofs that user previously tracked that
	// are not in the current profile:
	diff := (*tracked).Subtract(*found)

	for _, e := range diff {
		if e.GetProofState() != keybase1.ProofState_OK {
			continue
		}

		// A proof that was previously tracked as GOOD
		// is missing, so it has been REVOKED.
		s.res.RevokedDetails = append(s.res.RevokedDetails, ExportTrackIDComponentToRevokedProof(e))
		if s.tmpTrack == nil {
			s.res.Revoked = append(s.res.Revoked, TrackDiffRevoked{e})
			continue
		}

		// There is a snoozed track in s.tmpTrack.
		// The user could have snoozed the revoked proof already.
		// Check s.tmpTrack to see if that is the case.
		if s.tmpTrack.set.HasMember(e) {
			// proof was in snooze, too, so mark it as revoked.
			s.res.Revoked = append(s.res.Revoked, TrackDiffRevoked{e})
		} else {
			// proof wasn't in snooze, so revoked proof already snoozed.
			s.res.Revoked = append(s.res.Revoked, TrackDiffSnoozedRevoked{e})
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
		if s.tmpTrack != nil {
			c.tmpTrackedProofState = s.tmpTrack.GetProofState(c.link.ToIDString())
			c.tmpTrackExpireTime = s.tmpTrack.GetTmpExpireTime()
		}
	}
}

func (s *IdentifyState) Precompute(dhook func(keybase1.IdentifyKey) error) {
	s.computeKeyDiffs(dhook)
	s.initResultList()
	s.computeTrackDiffs()
	s.computeRevokedProofs()
}

func (s *IdentifyState) computeKeyDiffs(dhook func(keybase1.IdentifyKey) error) {
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
		if fp, ok := s.u.GetKeyFamily().kid2pgp[kid]; ok {
			k.PGPFingerprint = fp[:]
		}
		// Anything other than a no difference here should be displayed to
		// the user.
		if diff != nil {
			k.BreaksTracking = diff.BreaksTracking()
		}
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
			// the identify outcome should know that this
			// key was revoked, as well as there being
			// a KeyDiff:
			s.res.Revoked = append(s.res.Revoked, diff)
			display(kid, diff)
		}
	}
}

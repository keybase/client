// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"sort"
	"strings"

	"github.com/keybase/client/go/gregor"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type IdentifyOutcome struct {
	Contextified
	Username              NormalizedUsername
	Error                 error
	KeyDiffs              []TrackDiff
	Revoked               []TrackDiff
	RevokedDetails        []keybase1.RevokedProof
	ProofChecks           []*LinkCheckResult
	Warnings              []Warning
	TrackUsed             *TrackLookup
	TrackEqual            bool // Whether the track statement was equal to what we saw
	TrackOptions          keybase1.TrackOptions
	Reason                keybase1.IdentifyReason
	ResponsibleGregorItem gregor.Item
}

func NewIdentifyOutcomeWithUsername(g *GlobalContext, u NormalizedUsername) *IdentifyOutcome {
	return &IdentifyOutcome{Contextified: NewContextified(g), Username: u}
}

func (i *IdentifyOutcome) remoteProofLinks() *RemoteProofLinks {
	rpl := NewRemoteProofLinks(i.G())
	for _, p := range i.ProofChecks {
		rpl.Insert(p.link, p.err)
	}
	return rpl
}

func (i *IdentifyOutcome) GetRemoteCheckResultFor(service string, username string) ProofError {
	cieq := func(a, b string) bool { return strings.ToLower(a) == strings.ToLower(b) }
	for _, pc := range i.ProofChecks {
		k, v := pc.GetLink().ToKeyValuePair()
		if cieq(k, service) && cieq(v, username) {
			return pc.GetProofError()
		}
	}
	return NewProofError(keybase1.ProofStatus_NO_HINT, "no proof checked for %s@%s", username, service)
}

func (i *IdentifyOutcome) ActiveProofs() []RemoteProofChainLink {
	return i.remoteProofLinks().Active()
}

func (i *IdentifyOutcome) AddProofsToSet(existing *ProofSet, okStates []keybase1.ProofState) {
	i.remoteProofLinks().AddProofsToSet(existing, okStates)
}

func (i *IdentifyOutcome) TrackSet() *TrackSet {
	return i.remoteProofLinks().TrackSet()
}

func (i *IdentifyOutcome) ProofChecksSorted(mctx MetaContext) []*LinkCheckResult {
	// Sort by display priority
	pc := make([]*LinkCheckResult, len(i.ProofChecks))
	copy(pc, i.ProofChecks)
	proofServices := i.G().GetProofServices()
	serviceTypes := map[string]int{}
	for _, lcr := range pc {
		key := lcr.link.DisplayPriorityKey()
		if _, ok := serviceTypes[key]; !ok {
			st := proofServices.GetServiceType(mctx.Ctx(), key)
			displayPriority := 0
			if st != nil {
				displayPriority = st.DisplayPriority()
			}
			serviceTypes[key] = displayPriority
		}
	}
	sort.Slice(pc, func(a, b int) bool {
		keyA := pc[a].link.DisplayPriorityKey()
		keyB := pc[b].link.DisplayPriorityKey()
		return serviceTypes[keyA] > serviceTypes[keyB]
	})
	return pc
}

// Revoked proofs are those we used to look for but are gone!
func (i IdentifyOutcome) NumRevoked() int {
	return len(i.Revoked)
}

// The number of proofs that failed.
func (i IdentifyOutcome) NumProofFailures() int {
	nfails := 0
	for _, c := range i.ProofChecks {
		if c.err != nil {
			nfails++
		}
	}
	return nfails
}

// The number of proofs that actually worked
func (i IdentifyOutcome) NumProofSuccesses() int {
	nsucc := 0
	for _, c := range i.ProofChecks {
		if c.err == nil {
			nsucc++
		}
	}
	return nsucc
}

// A "Track Failure" is when we previously tracked this user, and
// some aspect of their proof changed.  Like their key changed, or
// they changed Twitter names
func (i IdentifyOutcome) NumTrackFailures() int {
	ntf := 0
	check := func(d TrackDiff) bool {
		return d != nil && d.BreaksTracking()
	}
	for _, c := range i.ProofChecks {
		if check(c.diff) || check(c.remoteDiff) {
			ntf++
		}
	}

	for _, k := range i.KeyDiffs {
		if check(k) {
			ntf++
		}
	}

	return ntf
}

// A "Track Change" isn't necessary a failure, maybe they upgraded
// a proof from HTTP to HTTPS.  But we still should retrack if we can.
func (i IdentifyOutcome) NumTrackChanges() int {
	ntc := 0
	check := func(d TrackDiff) bool {
		return d != nil && !d.IsSameAsTracked()
	}
	for _, c := range i.ProofChecks {
		if check(c.diff) || check(c.remoteDiff) {
			ntc++
		}
	}
	for _, k := range i.KeyDiffs {
		if check(k) {
			ntc++
		}
	}
	return ntc
}

func (i IdentifyOutcome) TrackStatus() keybase1.TrackStatus {
	if i.NumRevoked() > 0 {
		return keybase1.TrackStatus_UPDATE_BROKEN_REVOKED
	}
	if i.NumTrackFailures() > 0 {
		return keybase1.TrackStatus_UPDATE_BROKEN_FAILED_PROOFS
	}
	if i.TrackUsed != nil {
		if i.NumTrackChanges() > 0 {
			return keybase1.TrackStatus_UPDATE_NEW_PROOFS
		}
		if i.NumTrackChanges() == 0 {
			return keybase1.TrackStatus_UPDATE_OK
		}
	}
	if i.NumProofSuccesses() == 0 {
		return keybase1.TrackStatus_NEW_ZERO_PROOFS
	}
	if i.NumProofFailures() > 0 {
		return keybase1.TrackStatus_NEW_FAIL_PROOFS
	}
	return keybase1.TrackStatus_NEW_OK
}

func (i IdentifyOutcome) IsOK() bool {
	switch i.TrackStatus() {
	case keybase1.TrackStatus_UPDATE_NEW_PROOFS:
		return true
	case keybase1.TrackStatus_UPDATE_OK:
		return true
	case keybase1.TrackStatus_NEW_ZERO_PROOFS:
		return true
	case keybase1.TrackStatus_NEW_OK:
		return true
	default:
		return false
	}
}

func (i IdentifyOutcome) TrackingStatement() *jsonw.Wrapper {
	return i.remoteProofLinks().TrackingStatement()
}

func (i IdentifyOutcome) GetErrorAndWarnings(strict bool) (warnings Warnings, err error) {

	if i.Error != nil {
		err = i.Error
		return warnings, err
	}

	var probs []string

	softErr := func(s string) {
		if strict {
			probs = append(probs, s)
		} else {
			warnings.Push(StringWarning(s))
		}
	}

	// For revoked proofs, we almost always want to return an error. The one exception
	// is a snoozed tracker proof in non-strict mode.
	for _, revoked := range i.Revoked {
		errString := revoked.ToDisplayString()
		isSnoozed := false
		if _, ok := revoked.(TrackDiffSnoozedRevoked); ok {
			isSnoozed = true
		}

		if !strict && isSnoozed {
			warnings.Push(StringWarning(errString))
		} else {
			probs = append(probs, errString)
		}
	}

	if nfails := i.NumProofFailures(); nfails > 0 {
		p := fmt.Sprintf("PROBLEM: %d proof%s failed remote checks", nfails, GiveMeAnS(nfails))
		softErr(p)
	}

	if ntf := i.NumTrackFailures(); ntf > 0 {
		probs = append(probs,
			fmt.Sprintf("%d followed proof%s failed",
				ntf, GiveMeAnS(ntf)))
	}

	if len(probs) > 0 {
		err = IdentifySummaryError{i.Username, probs}
	}

	return warnings, err
}

func (i IdentifyOutcome) GetError() error {
	_, e := i.GetErrorAndWarnings(true)
	return e
}

func (i IdentifyOutcome) GetErrorLax() (Warnings, error) {
	return i.GetErrorAndWarnings(false)
}

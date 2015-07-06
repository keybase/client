package libkb

import (
	"fmt"
	"sort"
	"strings"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

type IdentifyOutcome struct {
	Username      string
	Error         error
	KeyDiffs      []TrackDiff
	Revoked       []TrackDiffRevoked
	ProofChecks   []*LinkCheckResult
	Warnings      []Warning
	TrackUsed     *TrackLookup
	TrackEqual    bool // Whether the track statement was equal to what we saw
	MeSet         bool // whether me was set at the time
	LocalOnly     bool
	ApproveRemote bool
}

func NewIdentifyOutcome(m bool) *IdentifyOutcome {
	return &IdentifyOutcome{
		MeSet: m,
	}
}

func (i *IdentifyOutcome) remoteProofLinks() *RemoteProofLinks {
	rpl := NewRemoteProofLinks()
	for _, p := range i.ProofChecks {
		rpl.Insert(p.link, p.err)
	}
	return rpl
}

func (i *IdentifyOutcome) ActiveProofs() []RemoteProofChainLink {
	return i.remoteProofLinks().Active()
}

func (i *IdentifyOutcome) AddProofsToSet(existing *ProofSet) {
	i.remoteProofLinks().AddProofsToSet(existing)
}

func (i *IdentifyOutcome) TrackSet() *TrackSet {
	return i.remoteProofLinks().TrackSet()
}

func (i *IdentifyOutcome) ProofChecksSorted() []*LinkCheckResult {
	m := make(map[keybase1.ProofType][]*LinkCheckResult)
	for _, p := range i.ProofChecks {
		pt := p.link.GetProofType()
		m[pt] = append(m[pt], p)
	}

	var res []*LinkCheckResult
	for _, pt := range RemoteServiceOrder {
		pc, ok := m[pt]
		if !ok {
			continue
		}
		sort.Sort(byDisplayString(pc))
		res = append(res, pc...)
	}
	return res
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
	if i.NumTrackFailures() > 0 || i.NumRevoked() > 0 {
		return keybase1.TrackStatus_UPDATE_BROKEN
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

func (i IdentifyOutcome) TrackingStatement() *jsonw.Wrapper {
	return i.remoteProofLinks().TrackingStatement()
}

func (i IdentifyOutcome) GetErrorAndWarnings(strict bool) (warnings Warnings, err error) {

	if i.Error != nil {
		err = i.Error
		return
	}

	var probs []string

	softErr := func(s string) {
		if strict {
			probs = append(probs, s)
		} else {
			warnings.Push(StringWarning(s))
		}
	}

	for _, revoked := range i.Revoked {
		softErr(revoked.ToDisplayString())
	}

	if nfails := i.NumProofFailures(); nfails > 0 {
		p := fmt.Sprintf("PROBLEM: %d proof%s failed remote checks", nfails, GiveMeAnS(nfails))
		softErr(p)
	}

	if ntf := i.NumTrackFailures(); ntf > 0 {
		probs = append(probs,
			fmt.Sprintf("%d track component%s failed",
				ntf, GiveMeAnS(ntf)))
	}

	if len(probs) > 0 {
		err = fmt.Errorf("%s", strings.Join(probs, ";"))
	}

	return
}

func (i IdentifyOutcome) GetError() error {
	_, e := i.GetErrorAndWarnings(true)
	return e
}

func (i IdentifyOutcome) GetErrorLax() (Warnings, error) {
	return i.GetErrorAndWarnings(true)
}

type byDisplayString []*LinkCheckResult

func (a byDisplayString) Len() int      { return len(a) }
func (a byDisplayString) Swap(i, j int) { a[i], a[j] = a[j], a[i] }
func (a byDisplayString) Less(i, j int) bool {
	return a[i].link.ToDisplayString() < a[j].link.ToDisplayString()
}

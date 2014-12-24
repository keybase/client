package libkb

import (
	"fmt"
	"strings"
	"sync"
)

func (u *User) IdentifyKey(is IdentifyState) error {
	var diff TrackDiff
	if mt := is.track; mt != nil {
		diff = mt.ComputeKeyDiff(*u.activePgpFingerprint)
		is.res.KeyDiff = diff
	}
	fp, e := u.GetActivePgpFingerprint()
	if e != nil {
		return e
	}
	is.GetUI().DisplayKey(fp, diff)

	return nil
}

type IdentifyArg struct {
	Me      *User // The user who's doing the tracking
	Ui      IdentifyUI
	noCache bool
}

func (i IdentifyArg) MeSet() bool {
	return i.Me != nil
}

type IdentifyRes struct {
	Error       error
	KeyDiff     TrackDiff
	Deleted     []TrackDiffDeleted
	ProofChecks []*LinkCheckResult
	Warnings    []Warning
	TrackUsed   *TrackLookup
	TrackEqual  bool // Whether the track statement was equal to what we saw
	MeSet       bool // whether me was set at the time
}

func (i IdentifyRes) NumDeleted() int {
	return len(i.Deleted)
}

func (i IdentifyRes) NumProofFailures() int {
	nfails := 0
	for _, c := range i.ProofChecks {
		if c.err != nil {
			nfails++
		}
	}
	return nfails
}

func (i IdentifyRes) NumProofSuccesses() int {
	nsucc := 0
	for _, c := range i.ProofChecks {
		if c.err == nil {
			nsucc++
		}
	}
	return nsucc
}

func (i IdentifyRes) NumTrackFailures() int {
	ntf := 0
	check := func(d TrackDiff) bool {
		return d != nil && d.BreaksTracking()
	}
	for _, c := range i.ProofChecks {
		if check(c.diff) || check(c.remoteDiff) {
			ntf++
		}
	}
	if check(i.KeyDiff) {
		ntf++
	}
	return ntf
}

func (i IdentifyRes) NumTrackChanges() int {
	ntc := 0
	check := func(d TrackDiff) bool {
		return d != nil && !d.IsSameAsTracked()
	}
	for _, c := range i.ProofChecks {
		if check(c.diff) || check(c.remoteDiff) {
			ntc++
		}
	}
	return ntc
}

func (i IdentifyRes) GetErrorAndWarnings(strict bool) (err error, warnings Warnings) {

	if i.Error != nil {
		err = i.Error
		return
	}

	probs := make([]string, 0, 0)

	soft_err := func(s string) {
		if strict {
			probs = append(probs, s)
		} else {
			warnings.Push(StringWarning(s))
		}
	}

	for _, deleted := range i.Deleted {
		soft_err(deleted.ToDisplayString())
	}

	if nfails := i.NumProofFailures(); nfails > 0 {
		p := fmt.Sprintf("PROBLEM: %d proof%s failed remote checks", nfails, GiveMeAnS(nfails))
		soft_err(p)
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

func (i IdentifyRes) GetError() error {
	e, _ := i.GetErrorAndWarnings(true)
	return e
}

func (i IdentifyRes) GetErrorLax() (error, Warnings) {
	return i.GetErrorAndWarnings(true)
}

func NewIdentifyRes(m bool) *IdentifyRes {
	return &IdentifyRes{
		MeSet:       m,
		Warnings:    make([]Warning, 0, 0),
		ProofChecks: make([]*LinkCheckResult, 0, 1),
	}
}

type IdentifyState struct {
	arg   *IdentifyArg
	res   *IdentifyRes
	u     *User
	track *TrackLookup
	mutex *sync.Mutex
}

func (s IdentifyState) GetUI() IdentifyUI {
	return s.arg.Ui
}

func (s *IdentifyState) Lock() {
	s.mutex.Lock()
}

func (s *IdentifyState) Unlock() {
	s.mutex.Unlock()
}

func NewIdentifyState(arg *IdentifyArg, res *IdentifyRes, u *User) IdentifyState {
	return IdentifyState{arg, res, u, nil, new(sync.Mutex)}
}

func (s *IdentifyState) ComputeDeletedProofs() {
	if s.track == nil {
		return
	}
	found := s.u.IdTable.MakeTrackSet()
	tracked := s.track.set

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

func (is *IdentifyState) InitResultList() {
	idt := is.u.IdTable
	l := len(idt.activeProofs)
	is.res.ProofChecks = make([]*LinkCheckResult, l)
	for i, p := range idt.activeProofs {
		is.res.ProofChecks[i] = &LinkCheckResult{link: p, trackedProofState: PROOF_STATE_NONE, position: i}
	}
}

func (is *IdentifyState) ComputeTrackDiffs() {
	if is.track != nil {
		G.Log.Debug("| with tracking %v", is.track.set)
		for _, c := range is.res.ProofChecks {
			c.diff = c.link.ComputeTrackDiff(is.track)
			c.trackedProofState = is.track.GetProofState(c.link)
		}
	}
}

func (u *User) _identify(arg IdentifyArg) (res *IdentifyRes) {

	if !arg.noCache {
		if cir := u.cachedIdentifyRes; cir != nil && (arg.MeSet() == cir.MeSet) {
			return cir
		}
	}

	res = NewIdentifyRes(arg.MeSet())
	is := NewIdentifyState(&arg, res, u)

	if arg.Me == nil {
		// noop
	} else if tlink, err := arg.Me.GetTrackingStatementFor(u.name, u.id); err != nil {
		res.Error = err
		return
	} else if tlink != nil {
		is.track = NewTrackLookup(tlink)
		res.TrackUsed = is.track
	}

	is.GetUI().ReportLastTrack(is.track)

	G.Log.Debug("+ Identify(%s)", u.name)

	if res.Error = u.IdentifyKey(is); res.Error != nil {
		return
	}

	is.InitResultList()
	is.ComputeTrackDiffs()
	is.ComputeDeletedProofs()

	is.GetUI().LaunchNetworkChecks(res)
	u.IdTable.Identify(is)

	G.Log.Debug("- Identify(%s)", u.name)
	u.cachedIdentifyRes = res
	return
}

func (u *User) Identify(arg IdentifyArg) (TrackInstructions, error) {
	arg.Ui.Start()
	res := u._identify(arg)
	return arg.Ui.FinishAndPrompt(res)
}

func (u *User) IdentifySimple(me *User) error {
	_, err := u.Identify(IdentifyArg{
		Me: me,
		Ui: G.UI.GetIdentifyUI(u),
	})
	return err
}

func (u *User) IdentifySelf(ui IdentifyUI) (fp *PgpFingerprint, err error) {

	fp, err = u.GetActivePgpFingerprint()
	if err != nil {
		return
	}

	if ui == nil {
		ui = G.UI.GetIdentifySelfUI(u)
	}

	_, err = u.Identify(IdentifyArg{Me: u, Ui: ui})

	if err == nil {
		G.Log.Warning("Setting PGP fingerprint to: %s", fp.ToQuads())
		G.Env.GetConfigWriter().SetPgpFingerprint(fp)
	}

	return
}

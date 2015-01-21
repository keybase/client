package libkb

import (
	"fmt"
	"strings"
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
	is.GetUI().DisplayKey(fp.ExportToFOKID(), ExportTrackDiff(diff))

	return nil
}

type IdentifyArgPrime struct {
	Uid            *UID
	User           string
	TrackStatement bool
	Luba           bool
	LoadSelf       bool
	LogUI          LogUI
}

type IdentifyArg struct {
	Me *User // The user who's doing the tracking
	Ui IdentifyUI
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

	softErr := func(s string) {
		if strict {
			probs = append(probs, s)
		} else {
			warnings.Push(StringWarning(s))
		}
	}

	for _, deleted := range i.Deleted {
		softErr(deleted.ToDisplayString())
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
}

func (s IdentifyState) GetUI() IdentifyUI {
	return s.arg.Ui
}

func NewIdentifyState(arg *IdentifyArg, res *IdentifyRes, u *User) IdentifyState {
	return IdentifyState{arg, res, u, nil}
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

func (s *IdentifyState) InitResultList() {
	idt := s.u.IdTable
	l := len(idt.activeProofs)
	s.res.ProofChecks = make([]*LinkCheckResult, l)
	for i, p := range idt.activeProofs {
		s.res.ProofChecks[i] = &LinkCheckResult{link: p, trackedProofState: PROOF_STATE_NONE, position: i}
	}
}

func (s *IdentifyState) ComputeTrackDiffs() {
	if s.track != nil {
		G.Log.Debug("| with tracking %v", s.track.set)
		for _, c := range s.res.ProofChecks {
			c.diff = c.link.ComputeTrackDiff(s.track)
			c.trackedProofState = s.track.GetProofState(c.link)
		}
	}
}

func (u *User) _identify(arg IdentifyArg) (res *IdentifyRes) {
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

	is.GetUI().ReportLastTrack(ExportTrackSummary(is.track))

	G.Log.Debug("+ Identify(%s)", u.name)

	if res.Error = u.IdentifyKey(is); res.Error != nil {
		return
	}

	is.InitResultList()
	is.ComputeTrackDiffs()
	is.ComputeDeletedProofs()

	is.GetUI().LaunchNetworkChecks(res.ExportToUncheckedIdentity())
	u.IdTable.Identify(is)

	G.Log.Debug("- Identify(%s)", u.name)
	return
}

func (u *User) Identify(arg IdentifyArg) (ti TrackInstructions, err error) {
	arg.Ui.Start()
	res := u._identify(arg)
	tmp, err := arg.Ui.FinishAndPrompt(res.Export())
	fpr := ImportFinishAndPromptRes(tmp)
	return fpr, err
}

func (u *User) IdentifySimple(me *User, ui IdentifyUI) error {
	_, err := u.Identify(IdentifyArg{
		Me: me,
		Ui: ui,
	})
	return err
}

func (u *User) IdentifySelf(ui IdentifyUI) (fp *PgpFingerprint, err error) {

	fp, err = u.GetActivePgpFingerprint()
	if err != nil {
		return
	}

	if ui == nil {
		err = NoUiError{"identify"}
		return
	}

	_, err = u.Identify(IdentifyArg{Me: u, Ui: ui})

	if err == nil {
		cw := G.Env.GetConfigWriter()
		cw.SetPgpFingerprint(fp)
		if err = cw.Write(); err != nil {
			G.Log.Error("Write error: %s", err.Error())
		}
	}

	return
}

// IdentifyEng is the type used by cmd_id Run, daemon id handler.
type IdentifyEng struct {
	arg *IdentifyArgPrime
	ui  IdentifyUI
}

func NewIdentifyEng(arg *IdentifyArgPrime, ui IdentifyUI) *IdentifyEng {
	return &IdentifyEng{arg: arg, ui: ui}
}

func (e *IdentifyEng) Run() error {
	if e.arg.Luba {
		return e.RunLuba()
	}
	return e.RunStandard()
}

func (e *IdentifyEng) RunLuba() error {
	r := LoadUserByAssertions(e.arg.User, e.arg.LoadSelf, e.ui)
	if r.Error != nil {
		return r.Error
	}
	G.Log.Info("Success; loaded %s", r.User.GetName())
	return nil
}

func (e *IdentifyEng) RunStandard() error {
	arg := LoadUserArg{
		Self: (len(e.arg.User) == 0),
	}
	if e.arg.Uid != nil {
		arg.Uid = e.arg.Uid
	} else {
		arg.Name = e.arg.User
	}
	u, err := LoadUser(arg)
	if err != nil {
		return err
	}
	if e.ui == nil {
		e.ui = G.UI.GetIdentifyUI(u.GetName())
	}
	err = u.IdentifySimple(nil, e.ui)
	if err != nil {
		return err
	}

	if !e.arg.TrackStatement {
		return nil
	}
	if arg.Self == true {
		return nil
	}

	// they want a json tracking statement:
	me, err := LoadMe(LoadUserArg{LoadSecrets: true})
	if err != nil {
		G.Log.Warning("error loading me: %s", err)
		return err
	}
	stmt, err := TrackStatementJSON(me, u)
	if err != nil {
		G.Log.Warning("error getting track statement: %s", err)
		return err
	}
	// return e.ui.DisplayTrackStatement(DisplayTrackArg(0, stmt))
	G.Log.Info("json track statement: %s", stmt)
	return e.ui.DisplayTrackStatement(stmt)
}

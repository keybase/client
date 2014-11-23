package libkb

import (
	"fmt"
	"strings"
	"sync"
)

func (u *User) IdentifyKey(is IdentifyState) error {
	var ds string
	if mt := is.track; mt != nil {
		diff := mt.ComputeKeyDiff(*u.activePgpFingerprint)
		is.res.KeyDiff = diff
		ds = diff.ToDisplayString() + " "
	}
	fp, e := u.GetActivePgpFingerprint()
	if e != nil {
		return e
	}
	msg := CHECK + " " + ds +
		ColorString("green", "public key fingerprint: "+fp.ToQuads())
	is.Report(msg)
	return nil
}

type IdentifyArg struct {
	Me *User // The user who's doing the tracking
	Ui IdentifyUi
}

func (i IdentifyArg) MeSet() bool {
	return i.Me != nil
}

type IdentifyRes struct {
	Error       error
	KeyDiff     TrackDiff
	Lost        []TrackDiffLost
	ProofChecks []LinkCheckResult
	Warnings    []Warning
	Messages    []string
	MeSet       bool // whether me was set at the time
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

func (i IdentifyRes) NumTrackFailures() int {
	ntf := 0
	for _, c := range i.ProofChecks {
		if c.diff != nil && c.diff.BreaksTracking() {
			ntf++
		}
	}
	return ntf
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

	for _, lost := range i.Lost {
		soft_err(lost.ToDisplayString())
	}

	if nfails := i.NumProofFailures(); nfails > 0 {
		p := fmt.Sprintf("PROBLEM: %d proof%s failed remote checks", nfails, GiveMeAnS(nfails))
		soft_err(p)
	}

	if ntf := i.NumTrackFailures(); ntf > 0 {
		probs = append(probs,
			fmt.Sprintf("%d track copmonent%s failed",
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

func (i IdentifyState) Report(m string) {
	i.res.Messages = append(i.res.Messages, m)
	if i.arg.ReportHook != nil {
		i.arg.ReportHook(m + "\n")
	}
}

func NewIdentifyRes(m bool) *IdentifyRes {
	return &IdentifyRes{
		MeSet:       m,
		Messages:    make([]string, 0, 1),
		Warnings:    make([]Warning, 0, 0),
		ProofChecks: make([]LinkCheckResult, 0, 1),
	}
}

type IdentifyState struct {
	arg   *IdentifyArg
	res   *IdentifyRes
	u     *User
	track *TrackLookup
	mutex *sync.Mutex
}

func (s *IdentifyState) Lock() {
	s.mutex.Lock()
}

func (s *IdentifyState) Unlock() {
	s.mutex.Unlock()
}

func (res *IdentifyRes) AddLinkCheckResult(lcr LinkCheckResult) {
	res.ProofChecks = append(res.ProofChecks, lcr)
}

func NewIdentifyState(arg *IdentifyArg, res *IdentifyRes, u *User) IdentifyState {
	return IdentifyState{arg, res, u, nil, new(sync.Mutex)}
}

func (u *User) _identify(arg IdentifyArg) (res *IdentifyRes) {

	if cir := u.cachedIdentifyRes; cir != nil && (arg.MeSet() == cir.MeSet) {
		return cir
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
		msg := ColorString("bold", fmt.Sprintf("You last tracked %s on %s",
			u.name, FormatTime(is.track.GetCTime())))
		is.Report(msg)
	}

	G.Log.Debug("+ Identify(%s)", u.name)

	if res.Error = u.IdentifyKey(is); res.Error != nil {
		return
	}
	u.IdTable.Identify(is)

	if is.track != nil {
		found := u.IdTable.MakeTrackSet()
		tracked := is.track.set
		if missing, ok := tracked.SubsetOf(found); !ok {
			for _, m := range missing {
				res.Lost = append(res.Lost, TrackDiffLost{m})
			}
		}
	}

	G.Log.Debug("- Identify(%s)", u.name)
	u.cachedIdentifyRes = res
	return
}

func (u *User) Identify(arg IdentifyArg) error {
	arg.ui.Start()
	res := u._identify(arg)
	return arg.ui.FinishAndPrompt(res)
}

func (u *User) IdentifySimple(me *User) error {
	res := u.Identify(IdentifyArg{
		ReportHook: func(s string) { G.OutputString(s) },
		Me:         me,
	})
	return res.GetError()
}

func (u *User) IdentifySelf() error {

	ui := G.UI.GetSelfIdentifyUI()

	targ, err := u.GetActivePgpFingerprint()
	if err != nil {
		return err
	}

	err = u.Identify(IdentifyArg{
		Me: u,
		Ui: identifier,
	})

	if err == nil {
		G.Log.Warning("Setting PGP fingerprint to: %s", targ.ToQuads())
		G.Env.GetConfigWriter().SetPgpFingerprint(targ)
	}

	return err
}

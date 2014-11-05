package libkb

import (
	"fmt"
	"strings"
)

func (u *User) IdentifyKey(is IdentifyState) {
	var ds string
	if mt := is.track; mt != nil {
		diff := mt.ComputeKeyDiff(*u.activePgpFingerprint)
		is.res.KeyDiff = diff
		ds = diff.ToDisplayString() + " "
	}
	msg := CHECK + " " + ds +
		ColorString("green", "public key fingerprint: "+
			u.activePgpFingerprint.ToQuads())
	is.Report(msg)
}

type IdentifyArg struct {
	ReportHook func(s string) // Can be nil
	Me         *User          // The user who's doing the tracking
}

func (i IdentifyArg) MeSet() bool {
	return i.Me != nil
}

type IdentifyRes struct {
	KeyDiff     TrackDiff
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

func (i IdentifyRes) GetError() error {
	probs := make([]string, 0, 0)

	if nfails := i.NumProofFailures(); nfails > 0 {
		probs = append(probs,
			fmt.Sprintf("%d proof%s failed remote checks",
				nfails, GiveMeAnS(nfails)))
	}
	if ntf := i.NumTrackFailures(); ntf > 0 {
		probs = append(probs,
			fmt.Sprintf("%d track copmonent%s failed",
				ntf, GiveMeAnS(ntf)))
	}
	if len(probs) > 0 {
		return fmt.Errorf("%s", strings.Join(probs, ";"))
	} else {
		return nil
	}
}

func (i IdentifyState) Report(m string) {
	i.res.Messages = append(i.res.Messages, m)
	if i.arg.ReportHook != nil {
		i.arg.ReportHook(m + "\n")
	}
}

func NewIdentifyRes() *IdentifyRes {
	return &IdentifyRes{
		MeSet:       false,
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
}

func (res *IdentifyRes) AddLinkCheckResult(lcr LinkCheckResult) {
	res.ProofChecks = append(res.ProofChecks, lcr)
}

func (u *User) Identify(arg IdentifyArg) *IdentifyRes {

	if cir := u.cachedIdentifyRes; cir != nil && (arg.MeSet() == cir.MeSet) {
		return cir
	}

	res := NewIdentifyRes()
	is := IdentifyState{&arg, res, u, nil}

	if arg.Me != nil {
		if tlink := arg.Me.GetTrackingStatementFor(u.name); tlink != nil {
			is.track = NewTrackLookup(tlink)
			msg := ColorString("bold", fmt.Sprintf("You last tracked %s on %s",
				u.name, FormatTime(is.track.GetCTime())))
			is.Report(msg)
		}
	}

	G.Log.Debug("+ Identify(%s)", u.name)

	u.IdentifyKey(is)
	u.IdTable.Identify(is)

	G.Log.Debug("- Identify(%s) -> %s", u.name, ErrToOk(res.GetError()))
	return res
}

func (u *User) IdentifySimple(me *User) error {
	res := u.Identify(IdentifyArg{
		ReportHook: func(s string) { G.OutputString(s) },
		Me:         me,
	})
	return res.GetError()
}

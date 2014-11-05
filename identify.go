package libkb

import (
	"fmt"
)

func (u *User) IdentifyKey() {
	var ds string
	if mt := u.IdTable.myTrack; mt != nil {
		diff := mt.ComputeKeyDiff(*u.activePgpFingerprint)
		ds = diff.ToDisplayString() + " "
	}
	G.OutputString(
		CHECK + " " + ds +
			ColorString("green", "public key fingerprint: "+
				u.activePgpFingerprint.ToQuads()) + "\n")
}

type IdentifyArg struct {
	ReportHook func(s string) // Can be nil
	Me         *User          // The user who's doing the tracking
}

func (i IdentifyArg) MeSet() bool {
	return i.Me != nil
}

type IdentifyRes struct {
	TrackDiffs TrackDiffSet
	Error      error
	Warnings   []Warning
	Messages   []string
	MeSet      bool // whether me was set..
}

func (i *IdentifyRes) Report(a *IdentifyArg, m string) {
	i.Messages = append(i.Messages, m)
	if a != nil && a.ReportHook != nil {
		a.ReportHook(m + "\n")
	}
}

func NewIdentifyRes() *IdentifyRes {
	return &IdentifyRes{
		MeSet:    false,
		Messages: make([]string, 0, 1),
		Warnings: make([]Warning, 0, 0),
	}
}

func (u *User) Identify(arg IdentifyArg) *IdentifyRes {

	if cir := u.cachedIdentifyRes; cir != nil && (arg.MeSet() == cir.MeSet) {
		return cir
	}

	res := NewIdentifyRes()

	G.Log.Debug("+ Identify(%s)", u.name)
	if mt := u.IdTable.myTrack; mt != nil {
		msg := ColorString("bold", fmt.Sprintf("You last tracked %s on %s",
			u.name, FormatTime(mt.GetCTime())))
		res.Report(arg, msg)
	}

	u.IdentifyKey()

	ret := u.IdTable.Identify()
	G.Log.Debug("- Identify(%s) -> %s", u.name, ErrToOk(ret))
	return ret
}

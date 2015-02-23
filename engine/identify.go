package engine

import (
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
)

type IdentifyArg struct {
	Uid            *libkb.UID
	User           string
	TrackStatement bool
	Luba           bool
	LoadSelf       bool
	LogUI          libkb.LogUI
}

type IdentifyRes struct {
	Outcome *libkb.IdentifyOutcome
	User    *libkb.User
}

// IdentifyEng is the type used by cmd_id Run, daemon id handler.
type IdentifyEng struct {
	arg *IdentifyArg
	ui  libkb.IdentifyUI
}

func NewIdentifyEng(arg *IdentifyArg, ui libkb.IdentifyUI) *IdentifyEng {
	return &IdentifyEng{arg: arg, ui: ui}
}

func (e *IdentifyEng) Run() (*IdentifyRes, error) {
	if e.arg.Luba {
		return e.RunLuba()
	}
	return e.RunStandard()
}

func (e *IdentifyEng) RunLuba() (*IdentifyRes, error) {
	r := libkb.LoadUserByAssertions(e.arg.User, e.arg.LoadSelf, e.ui)
	if r.Error != nil {
		return nil, r.Error
	}
	G.Log.Info("Success; loaded %s", r.User.GetName())
	res := &IdentifyRes{
		User:    r.User,
		Outcome: r.IdentifyRes,
	}
	return res, nil
}

func (e *IdentifyEng) RunStandard() (*IdentifyRes, error) {
	arg := libkb.LoadUserArg{
		Self: (len(e.arg.User) == 0),
	}
	if e.arg.Uid != nil {
		arg.Uid = e.arg.Uid
	} else {
		arg.Name = e.arg.User
	}
	u, err := libkb.LoadUser(arg)
	if err != nil {
		return nil, err
	}
	if e.ui == nil {
		e.ui = G.UI.GetIdentifyUI(u.GetName())
	}
	e.ui.SetUsername(u.GetName())
	outcome, err := u.IdentifySimple(nil, e.ui)
	if err != nil {
		return nil, err
	}

	res := &IdentifyRes{Outcome: outcome, User: u}

	if !e.arg.TrackStatement {
		return res, nil
	}
	if arg.Self == true {
		return res, nil
	}

	// they want a json tracking statement:
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		G.Log.Warning("error loading me: %s", err)
		return nil, err
	}
	stmt, err := TrackStatementJSON(me, u)
	if err != nil {
		G.Log.Warning("error getting track statement: %s", err)
		return nil, err
	}
	// return e.ui.DisplayTrackStatement(DisplayTrackArg(0, stmt))
	G.Log.Info("json track statement: %s", stmt)
	if err = e.ui.DisplayTrackStatement(stmt); err != nil {
		return nil, err
	}

	return res, nil
}

func (a IdentifyArg) Export() (res keybase_1.IdentifyArg) {
	if a.Uid != nil {
		res.Uid = a.Uid.Export()
	}
	res.Username = a.User
	res.TrackStatement = a.TrackStatement
	res.Luba = a.Luba
	res.LoadSelf = a.LoadSelf
	return res
}

func ImportIdentifyArg(a keybase_1.IdentifyArg) (ret IdentifyArg) {
	uid := libkb.ImportUID(a.Uid)
	if !uid.IsZero() {
		ret.Uid = &uid
	}
	ret.User = a.Username
	ret.TrackStatement = a.TrackStatement
	ret.Luba = a.Luba
	ret.LoadSelf = a.LoadSelf
	return ret
}

func (ir *IdentifyRes) Export() *keybase_1.IdentifyRes {
	return &keybase_1.IdentifyRes{
		Outcome: *((*ir.Outcome).Export()),
		User:    ir.User.Export(),
	}
}

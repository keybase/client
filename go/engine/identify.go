package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

type IdentifyEngineArg struct {
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
type IdentifyEngine struct {
	arg *IdentifyEngineArg
	res *IdentifyRes
}

func NewIdentifyEngine(arg *IdentifyEngineArg) *IdentifyEngine {
	return &IdentifyEngine{arg: arg}
}

func (s *IdentifyEngine) Name() string {
	return "Identify"
}

func (e *IdentifyEngine) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (k *IdentifyEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.IdentifyUIKind,
		libkb.LogUIKind,
	}
}

func (s *IdentifyEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *IdentifyEngine) Run(ctx *Context, arg interface{}, res interface{}) error {
	return e.run(ctx)
}

func (e *IdentifyEngine) run(ctx *Context) (err error) {
	var res *IdentifyRes
	if e.arg.Luba {
		res, err = e.runLuba(ctx)
	} else {
		res, err = e.runStandard(ctx)
	}
	e.res = res
	return err
}

func (e *IdentifyEngine) Result() *IdentifyRes {
	return e.res
}

func (e *IdentifyEngine) runLuba(ctx *Context) (*IdentifyRes, error) {
	r := libkb.LoadUserByAssertions(e.arg.User, e.arg.LoadSelf, ctx.IdentifyUI)
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

func (e *IdentifyEngine) runStandard(ctx *Context) (*IdentifyRes, error) {
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
	ui := ctx.IdentifyUI
	outcome, err := u.IdentifySimple(nil, u.GetName(), ui)
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
	stmt, err := me.TrackStatementJSON(u)
	if err != nil {
		G.Log.Warning("error getting track statement: %s", err)
		return nil, err
	}

	G.Log.Info("json track statement: %s", stmt)
	if err = ui.DisplayTrackStatement(stmt); err != nil {
		return nil, err
	}

	return res, nil
}

func (a IdentifyEngineArg) Export() (res keybase_1.IdentifyArg) {
	if a.Uid != nil {
		res.Uid = a.Uid.Export()
	}
	res.Username = a.User
	res.TrackStatement = a.TrackStatement
	res.Luba = a.Luba
	res.LoadSelf = a.LoadSelf
	return res
}

func ImportIdentifyEngineArg(a keybase_1.IdentifyArg) (ret IdentifyEngineArg) {
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

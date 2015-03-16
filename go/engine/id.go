package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

type IdEngineArg struct {
	Uid            *libkb.UID
	User           string
	TrackStatement bool
	Luba           bool
	LoadSelf       bool // this seems like a confusing name.  it maps to withTracking in luba.
	LogUI          libkb.LogUI
}

type IdRes struct {
	Outcome *libkb.IdentifyOutcome
	User    *libkb.User
}

// IdEng is the type used by cmd_id Run, daemon id handler.
type IdEngine struct {
	arg *IdEngineArg
	res *IdRes
}

func NewIdEngine(arg *IdEngineArg) *IdEngine {
	return &IdEngine{arg: arg}
}

func (s *IdEngine) Name() string {
	return "Id"
}

func (e *IdEngine) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (k *IdEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.IdentifyUIKind,
		libkb.LogUIKind,
	}
}

func (s *IdEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewLuba(nil),
	}
}

func (e *IdEngine) Run(ctx *Context, arg interface{}, res interface{}) error {
	return e.run(ctx)
}

func (e *IdEngine) run(ctx *Context) (err error) {
	var res *IdRes
	if e.arg.Luba {
		res, err = e.runLuba(ctx)
	} else {
		res, err = e.runStandard(ctx)
	}
	e.res = res
	return err
}

func (e *IdEngine) Result() *IdRes {
	return e.res
}

func (e *IdEngine) runLuba(ctx *Context) (*IdRes, error) {
	arg := &LubaArg{
		Assertion:    e.arg.User,
		WithTracking: e.arg.LoadSelf,
	}
	eng := NewLuba(arg)
	if err := RunEngine(eng, ctx, nil, nil); err != nil {
		return nil, err
	}

	G.Log.Info("Success; loaded %s", eng.User().GetName())
	res := &IdRes{
		User:    eng.User(),
		Outcome: eng.IdentifyRes(),
	}
	return res, nil
}

func (e *IdEngine) runStandard(ctx *Context) (*IdRes, error) {
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

	res := &IdRes{Outcome: outcome, User: u}

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

func (a IdEngineArg) Export() (res keybase_1.IdentifyArg) {
	if a.Uid != nil {
		res.Uid = a.Uid.Export()
	}
	res.Username = a.User
	res.TrackStatement = a.TrackStatement
	res.Luba = a.Luba
	res.LoadSelf = a.LoadSelf
	return res
}

func ImportIdEngineArg(a keybase_1.IdentifyArg) (ret IdEngineArg) {
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

func (ir *IdRes) Export() *keybase_1.IdentifyRes {
	return &keybase_1.IdentifyRes{
		Outcome: *((*ir.Outcome).Export()),
		User:    ir.User.Export(),
	}
}

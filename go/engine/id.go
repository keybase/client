package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

type IdEngineArg struct {
	UserAssertion  string
	TrackStatement bool // output a track statement
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

func (e *IdEngine) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: e.arg.TrackStatement}
}

func (k *IdEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.IdentifyUIKind,
		libkb.LogUIKind,
	}
}

func (s *IdEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewIdentify(nil),
	}
}

func (e *IdEngine) Run(ctx *Context) (err error) {
	e.res, err = e.run(ctx)
	return err
}

func (e *IdEngine) Result() *IdRes {
	return e.res
}

func (e *IdEngine) run(ctx *Context) (*IdRes, error) {
	iarg := NewIdentifyArg(e.arg.UserAssertion, e.arg.TrackStatement)
	ieng := NewIdentify(iarg)
	if err := RunEngine(ieng, ctx); err != nil {
		return nil, err
	}
	user := ieng.User()
	res := &IdRes{Outcome: ieng.Outcome(), User: user}

	if !e.arg.TrackStatement {
		return res, nil
	}

	// they want a json tracking statement:

	// check to make sure they aren't identifying themselves
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return nil, err
	}
	if me.Equal(user) {
		G.Log.Warning("can't generate track statement on yourself")
		// but let's not call this an error...they'll see the warning.
		return res, nil
	}

	stmt, err := me.TrackStatementJSON(user)
	if err != nil {
		G.Log.Warning("error getting track statement: %s", err)
		return nil, err
	}

	if err = ctx.IdentifyUI.DisplayTrackStatement(stmt); err != nil {
		return nil, err
	}

	return res, nil
}

func (a IdEngineArg) Export() (res keybase_1.IdentifyArg) {
	return keybase_1.IdentifyArg{
		UserAssertion:  a.UserAssertion,
		TrackStatement: a.TrackStatement,
	}
}

func ImportIdEngineArg(a keybase_1.IdentifyArg) (ret IdEngineArg) {
	return IdEngineArg{
		UserAssertion:  a.UserAssertion,
		TrackStatement: a.TrackStatement,
	}
}

func (ir *IdRes) Export() *keybase_1.IdentifyRes {
	return &keybase_1.IdentifyRes{
		Outcome: *((*ir.Outcome).Export()),
		User:    ir.User.Export(),
	}
}

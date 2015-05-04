package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type IDEngineArg struct {
	UserAssertion  string
	TrackStatement bool // output a track statement
}

type IDRes struct {
	Outcome *libkb.IdentifyOutcome
	User    *libkb.User
}

// IDEnginge is the type used by cmd_id Run, daemon id handler.
type IDEngine struct {
	arg *IDEngineArg
	res *IDRes
}

func NewIDEngine(arg *IDEngineArg) *IDEngine {
	return &IDEngine{arg: arg}
}

func (e *IDEngine) Name() string {
	return "Id"
}

func (e *IDEngine) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: e.arg.TrackStatement}
}

func (e *IDEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.IdentifyUIKind,
		libkb.LogUIKind,
	}
}

func (e *IDEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewIdentify(nil),
	}
}

func (e *IDEngine) Run(ctx *Context) (err error) {
	e.res, err = e.run(ctx)
	return err
}

func (e *IDEngine) Result() *IDRes {
	return e.res
}

func (e *IDEngine) run(ctx *Context) (*IDRes, error) {
	iarg := NewIdentifyArg(e.arg.UserAssertion, e.arg.TrackStatement)
	ieng := NewIdentify(iarg)
	if err := RunEngine(ieng, ctx); err != nil {
		return nil, err
	}
	user := ieng.User()
	res := &IDRes{Outcome: ieng.Outcome(), User: user}

	if !e.arg.TrackStatement {
		ctx.IdentifyUI.Finish()
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
		ctx.IdentifyUI.Finish()
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

	ctx.IdentifyUI.Finish()

	return res, nil
}

func (a IDEngineArg) Export() (res keybase1.IdentifyArg) {
	return keybase1.IdentifyArg{
		UserAssertion:  a.UserAssertion,
		TrackStatement: a.TrackStatement,
	}
}

func ImportIDEngineArg(a keybase1.IdentifyArg) (ret IDEngineArg) {
	return IDEngineArg{
		UserAssertion:  a.UserAssertion,
		TrackStatement: a.TrackStatement,
	}
}

func (ir *IDRes) Export() *keybase1.IdentifyRes {
	return &keybase1.IdentifyRes{
		Outcome: *((*ir.Outcome).Export()),
		User:    ir.User.Export(),
	}
}

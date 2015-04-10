package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
)

// Doctor is an engine.
type Doctor struct {
	libkb.Contextified
	runErr error
}

// NewDoctor creates a Doctor engine.
func NewDoctor() *Doctor {
	return &Doctor{}
}

// Name is the unique engine name.
func (e *Doctor) Name() string {
	return "Doctor"
}

// GetPrereqs returns the engine prereqs.
func (e *Doctor) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *Doctor) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.DoctorUIKind,
		libkb.LoginUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Doctor) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{&LoginEngine{}}
}

// Run starts the engine.
func (e *Doctor) Run(ctx *Context) error {
	e.login(ctx)
	e.status(ctx)
	e.fix(ctx)
	e.done(ctx)
	return e.runErr
}

func (e *Doctor) login(ctx *Context) {
	if e.runErr != nil {
		return
	}

	ok, err := e.G().Session.LoadAndCheck()
	if err != nil {
		e.runErr = err
		return
	}

	if ok {
		return
	}

	e.G().Log.Debug("login necessary")

	c := e.G().Env.GetConfig()
	if c == nil {
		e.runErr = libkb.NoUserConfigError{}
		return
	}

	current, other, err := c.GetAllUsernames()
	if err != nil {
		e.runErr = err
		return
	}
	e.G().Log.Debug("current: %s", current)
	e.G().Log.Debug("others: %v", other)
	if len(current) == 0 && len(other) == 0 {
		e.G().Log.Debug("no user accounts found on this device")
		e.runErr = errors.New("No user accounts were found on this device.  Run 'keybase signup' if you need an account or 'keybase login' if you already have one.")
		return
	}
	selected, err := ctx.DoctorUI.LoginSelect(current, other)
	if err != nil {
		e.runErr = err
		return
	}
	if len(selected) == 0 {
		e.runErr = errors.New("no user selected for login")
		return
	}
	e.G().Log.Debug("selected account %q for login", selected)

	eng := NewLoginWithPromptEngineSkipLocksmith(selected)
	if err := RunEngine(eng, ctx); err != nil {
		e.runErr = err
		return
	}

	e.G().Log.Debug("login as %q successful.", selected)
}

func (e *Doctor) status(ctx *Context) {
	if e.runErr != nil {
		return
	}
	e.runErr = ctx.DoctorUI.DisplayStatus()
}

func (e *Doctor) fix(ctx *Context) {
	if e.runErr != nil {
		return
	}
}

func (e *Doctor) done(ctx *Context) {
	if e.runErr != nil {
		return
	}
}

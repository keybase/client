package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// Doctor is an engine.
type Doctor struct {
	libkb.Contextified
	runErr error
	user   *libkb.User
}

// NewDoctor creates a Doctor engine.
func NewDoctor(g *libkb.GlobalContext) *Doctor {
	return &Doctor{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *Doctor) Name() string {
	return "Doctor"
}

// GetPrereqs returns the engine prereqs.
func (e *Doctor) Prereqs() Prereqs {
	return Prereqs{}
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
	return []libkb.UIConsumer{
		&LoginEngine{},
		&Locksmith{},
	}
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

	ok, err := IsLoggedIn(e, ctx)
	if err != nil {
		e.runErr = err
		return
	}

	if ok {
		e.G().Log.Debug("logged in already")
		e.user, err = libkb.LoadMe(libkb.LoadUserArg{ForceReload: true})
		if err != nil {
			e.runErr = err
		}
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

	eng := NewLoginWithPromptEngineSkipLocksmith(selected, e.G())
	if err := RunEngine(eng, ctx); err != nil {
		e.runErr = err
		return
	}

	e.G().Log.Debug("login as %q successful.", selected)
	e.user = eng.User()
}

// What should be in status:
// user
// key status
//
func (e *Doctor) status(ctx *Context) {
	if e.runErr != nil {
		return
	}

	e.G().Log.Debug("logged in as %q", e.user.GetName())

	arg := &LocksmithArg{
		User:      e.user,
		CheckOnly: true,
	}
	eng := NewLocksmith(arg, e.G())
	if err := RunEngine(eng, ctx); err != nil {
		e.runErr = err
		return
	}
	status := eng.Status()
	e.G().Log.Debug("locksmith status: %+v", status)

	signopts := keybase1.DoctorSignerOpts{
		OtherDevice: status.HaveActiveDevice,
		Pgp:         status.HavePGP,
		Internal:    status.NoKeys || status.HaveDetKey,
	}
	if signopts.OtherDevice {
		// if they have another active device, internal signing not an option
		signopts.Internal = false
	}
	uistatus := keybase1.DoctorStatus{
		SignerOpts: signopts,
	}
	if status.CurrentDeviceOk {
		uistatus.Fix = keybase1.DoctorFixType_NONE
	} else if status.HaveActiveDevice {
		uistatus.Fix = keybase1.DoctorFixType_ADD_SIBLING_DEVICE
	} else {
		uistatus.Fix = keybase1.DoctorFixType_ADD_ELDEST_DEVICE
	}

	// get list of active devices
	var err error
	var devs libkb.DeviceKeyMap
	aerr := e.G().LoginState().SecretSyncer(func(ss *libkb.SecretSyncer) {
		devs, err = ss.ActiveDevices()
	}, "Doctor - ActiveDevices")
	if aerr != nil {
		e.runErr = err
		return
	}
	if err != nil {
		e.runErr = err
		return
	}

	for k, v := range devs {
		dev := keybase1.Device{Type: v.Type, Name: v.Description, DeviceID: k}
		if v.Type != libkb.DEVICE_TYPE_WEB {
			uistatus.Devices = append(uistatus.Devices, dev)
		} else {
			uistatus.WebDevice = &dev
		}
	}
	kf := e.user.GetComputedKeyFamily()
	if kf != nil {
		cd, err := kf.GetCurrentDevice(e.G())
		if err == nil {
			uistatus.CurrentDevice = &keybase1.Device{
				DeviceID: cd.ID,
				Type:     cd.Type,
			}
			if cd.Description != nil {
				uistatus.CurrentDevice.Name = *cd.Description
			}
		}
	}

	// get list of pgp keys

	// get det key

	proceed, err := ctx.DoctorUI.DisplayStatus(uistatus)
	if err != nil {
		e.runErr = err
		return
	}
	if !proceed {
		e.runErr = libkb.CanceledError{M: "doctor cancelled"}
		return
	}
}

func (e *Doctor) fix(ctx *Context) {
	if e.runErr != nil {
		return
	}

	// just in case it's been a while from the DisplayStatus prompt until
	// we get here, just run the whole locksmith engine from scratch.
	// (state could have changed significantly)
	arg := &LocksmithArg{
		User: e.user,
	}
	eng := NewLocksmith(arg, e.G())
	if err := RunEngine(eng, ctx); err != nil {
		e.runErr = err
		return
	}
}

func (e *Doctor) done(ctx *Context) {
	if e.runErr != nil {
		return
	}
	e.runErr = ctx.DoctorUI.DisplayResult("done")
}

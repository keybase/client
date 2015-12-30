// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"net/url"

	"github.com/keybase/client/go/libkb"
)

type Prereqs struct {
	Session bool
	Device  bool
}

type Engine interface {
	Run(ctx *Context) error
	Prereqs() Prereqs
	libkb.UIConsumer
	G() *libkb.GlobalContext
}

type UIDelegateWanter interface {
	WantDelegate(libkb.UIKind) bool
}

func runPrereqs(e Engine, ctx *Context) (err error) {
	prq := e.Prereqs()

	if prq.Session {
		var ok bool
		ok, err = IsLoggedIn(e, ctx)
		if !ok {
			urlError, isURLError := err.(*url.Error)
			context := ""
			if isURLError {
				context = fmt.Sprintf("Encountered a network error: %s", urlError.Err)
			}
			err = libkb.LoginRequiredError{Context: context}
		}
		if err != nil {
			return err
		}
	}

	if prq.Device {
		var ok bool
		ok, err = IsProvisioned(e, ctx)
		if err != nil {
			return err
		}
		if !ok {
			err = libkb.DeviceRequiredError{}
			return err
		}
	}

	return

}

func RunEngine(e Engine, ctx *Context) (err error) {
	e.G().Log.Debug("+ RunEngine(%s)", e.Name())
	defer func() { e.G().Log.Debug("- RunEngine(%s) -> %s", e.Name(), libkb.ErrToOk(err)) }()

	if err = delegateUIs(e, ctx); err != nil {
		return err
	}
	if err = check(e, ctx); err != nil {
		return err
	}
	if err = runPrereqs(e, ctx); err != nil {
		return err
	}

	err = e.Run(ctx)
	return err
}

func delegateUIs(e Engine, ctx *Context) error {
	if e.G().UIRouter == nil {
		return nil
	}

	// currently, only doing this for SecretUI, but in future,
	// perhaps should iterate over all registered UIs in UIRouter.

	if requiresUI(e, libkb.SecretUIKind) {
		if ui, err := e.G().UIRouter.GetSecretUI(); err != nil {
			return err
		} else if ui != nil {
			e.G().Log.Debug("using delegated secret UI for engine %q", e.Name())
			ctx.SecretUI = ui
		}
	}

	if requiresUI(e, libkb.UpdateUIKind) {
		if ui, err := e.G().UIRouter.GetUpdateUI(); err != nil {
			return err
		} else if ui != nil {
			e.G().Log.Debug("using delegated update UI for engine %q", e.Name())
			ctx.UpdateUI = ui
		}
	}

	if wantsDelegateUI(e, libkb.IdentifyUIKind) {
		e.G().Log.Debug("IdentifyUI wanted for engine %q", e.Name())
		if ui, err := e.G().UIRouter.GetIdentifyUI(); err != nil {
			return err
		} else if ui != nil {
			e.G().Log.Debug("using delegated identify UI for engine %q", e.Name())
			ctx.IdentifyUI = ui
		}
	}

	return nil
}

func wantsDelegateUI(e Engine, kind libkb.UIKind) bool {
	if !requiresUI(e, kind) {
		return false
	}
	if i, ok := e.(UIDelegateWanter); ok {
		return i.WantDelegate(kind)
	}
	return false
}

func check(c libkb.UIConsumer, ctx *Context) error {
	if err := checkUI(c, ctx); err != nil {
		return CheckError{fmt.Sprintf("%s: %s", c.Name(), err)}
	}

	for _, sub := range c.SubConsumers() {
		if err := check(sub, ctx); err != nil {
			return CheckError{fmt.Sprintf("%s: %s", sub.Name(), err)}
		}
	}

	return nil
}

func checkUI(c libkb.UIConsumer, ctx *Context) error {
	for _, ui := range c.RequiredUIs() {
		if !ctx.HasUI(ui) {
			return CheckError{fmt.Sprintf("requires ui %q", ui)}
		}
	}
	return nil
}

func requiresUI(c libkb.UIConsumer, kind libkb.UIKind) bool {
	for _, ui := range c.RequiredUIs() {
		if ui == kind {
			return true
		}
	}

	for _, sub := range c.SubConsumers() {
		if requiresUI(sub, kind) {
			return true
		}
	}

	return false
}

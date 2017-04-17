// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// Bootstrap is an engine.
type Bootstrap struct {
	libkb.Contextified
	status keybase1.BootstrapStatus
}

// NewBootstrap creates a Bootstrap engine.
func NewBootstrap(g *libkb.GlobalContext) *Bootstrap {
	return &Bootstrap{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *Bootstrap) Name() string {
	return "Bootstrap"
}

// GetPrereqs returns the engine prereqs.
func (e *Bootstrap) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *Bootstrap) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Bootstrap) SubConsumers() []libkb.UIConsumer {
	return nil
}

/*
  record BootstrapStatus {
    UID uid;
    string username;
    DeviceID deviceID;
    string deviceName;
    boolean loggedIn;
    array<UserSummary> following;
    array<UserSummary> followers;
  }
*/

// Run starts the engine.
func (e *Bootstrap) Run(ctx *Context) error {
	var gerr error
	e.G().LoginState().Account(func(a *libkb.Account) {
		var in bool
		in, gerr = a.LoggedInProvisioned()
		if gerr != nil {
			e.G().Log.Debug("Bootstrap: LoggedInProvisioned error: %s", gerr)
			return
		}

		e.status.LoggedIn = in

		if !e.status.LoggedIn {
			return
		}
	}, "Bootstrap")

	if gerr != nil {
		return gerr
	}
	return nil
}

func (e *Bootstrap) Status() keybase1.BootstrapStatus {
	return e.status
}

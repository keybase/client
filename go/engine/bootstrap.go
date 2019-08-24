// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// Bootstrap is an engine.
type Bootstrap struct {
	libkb.Contextified
	status keybase1.BootstrapStatus
	usums  keybase1.UserSummary2Set
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

func (e *Bootstrap) lookupFullname(m libkb.MetaContext, uv keybase1.UserVersion) {
	pkgs, err := m.G().UIDMapper.MapUIDsToUsernamePackagesOffline(m.Ctx(), m.G(), []keybase1.UID{uv.Uid}, time.Duration(0))
	if err != nil {
		m.Warning("UID -> Username failed lookup: %s", err)
		return
	}
	pkg := pkgs[0]
	if pkg.NormalizedUsername.IsNil() || pkg.FullName == nil {
		m.Debug("Empty username for UID=%s", uv.Uid)
		return
	}
	if !uv.EldestSeqno.Eq(pkg.FullName.EldestSeqno) {
		m.Debug("Wrong eldest for username package; got %d but wanted %d", pkg.FullName.EldestSeqno, uv.EldestSeqno)
		return
	}
	e.status.Fullname = pkg.FullName.FullName
}

// Run starts the engine.
func (e *Bootstrap) Run(m libkb.MetaContext) error {
	e.status.Registered = e.signedUp(m)

	// if any Login engine worked previously, then ActiveDevice will
	// be valid:
	validActiveDevice := m.G().ActiveDevice.Valid()

	// the only way for ActiveDevice to be valid is to be logged in
	// (and provisioned)
	e.status.LoggedIn = validActiveDevice
	if !e.status.LoggedIn {
		m.Debug("Bootstrap: not logged in")
		return nil
	}
	m.Debug("Bootstrap: logged in (valid active device)")

	var uv keybase1.UserVersion
	uv, e.status.DeviceID, e.status.DeviceName, _, _ = e.G().ActiveDevice.AllFields()
	e.status.Uid = uv.Uid
	e.status.Username = e.G().ActiveDevice.Username(m).String()
	m.Debug("Bootstrap status: uid=%s, username=%s, deviceID=%s, deviceName=%s", e.status.Uid, e.status.Username, e.status.DeviceID, e.status.DeviceName)

	if chatHelper := e.G().ChatHelper; chatHelper != nil {
		e.status.UserReacjis = chatHelper.UserReacjis(m.Ctx(), e.status.Uid.ToBytes())
	}

	e.lookupFullname(m, uv)

	return nil
}

// signedUp is true if there's a uid in config.json.
func (e *Bootstrap) signedUp(m libkb.MetaContext) bool {
	cr := m.G().Env.GetConfig()
	if cr == nil {
		return false
	}
	if uid := cr.GetUID(); uid.Exists() {
		return true
	}
	return false
}

func (e *Bootstrap) Status() keybase1.BootstrapStatus {
	return e.status
}

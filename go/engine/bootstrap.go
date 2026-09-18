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
	defer m.Trace("Bootstrap.lookupFullname", nil)()
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

// SessionState reads the session fields that are available with nothing to wait
// on: the active device. Bootstrap fills the same fields plus the slower derived
// ones, so the two cannot drift. The returned UserVersion is the active device's,
// empty when logged out.
func SessionState(m libkb.MetaContext) (res keybase1.ClientSession, uv keybase1.UserVersion) {
	// if any Login engine worked previously, then ActiveDevice will
	// be valid; the only way for it to be valid is to be logged in
	// (and provisioned)
	res.LoggedIn = m.G().ActiveDevice.Valid()
	if !res.LoggedIn {
		return res, uv
	}

	uv, res.DeviceID, res.DeviceName, _, _ = m.G().ActiveDevice.AllFields()
	res.Uid = uv.Uid
	res.Username = m.G().ActiveDevice.Username(m).String()
	return res, uv
}

// Run starts the engine.
func (e *Bootstrap) Run(m libkb.MetaContext) (err error) {
	defer m.Trace("Bootstrap.Run", &err)()
	session, uv := SessionState(m)
	e.status.Registered = signedUp(m)
	e.status.LoggedIn = session.LoggedIn
	e.status.Uid = session.Uid
	e.status.Username = session.Username
	e.status.DeviceID = session.DeviceID
	e.status.DeviceName = session.DeviceName

	if !e.status.LoggedIn {
		m.Debug("Bootstrap: not logged in")
		return nil
	}
	m.Debug("Bootstrap: logged in (valid active device)")
	m.Debug("Bootstrap status: uid=%s, username=%s, deviceID=%s, deviceName=%s", e.status.Uid, e.status.Username, e.status.DeviceID, e.status.DeviceName)

	if chatHelper := e.G().ChatHelper; chatHelper != nil {
		e.status.UserReacjis = chatHelper.UserReacjis(m.Ctx(), e.status.Uid.ToBytes())
	}

	e.lookupFullname(m, uv)

	return nil
}

// signedUp is true if there's a uid in config.json.
func signedUp(m libkb.MetaContext) bool {
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

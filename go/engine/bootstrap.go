// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"context"

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

// Run starts the engine.
func (e *Bootstrap) Run(ctx *Context) error {
	e.status.Registered = e.signedUp()

	// if any Login engine worked previously, then ActiveDevice will
	// be valid:
	validActiveDevice := e.G().ActiveDevice.Valid()

	// the only way for ActiveDevice to be valid is to be logged in
	// (and provisioned)
	e.status.LoggedIn = validActiveDevice
	if !e.status.LoggedIn {
		e.G().Log.Debug("Bootstrap: not logged in")
		return nil
	}
	e.G().Log.Debug("Bootstrap: logged in (valid active device)")

	e.status.Uid, e.status.DeviceID, e.status.DeviceName, _, _ = e.G().ActiveDevice.AllFields()
	e.status.Username = e.G().Env.GetUsername().String()
	e.G().Log.Debug("Bootstrap status: uid=%s, username=%s, deviceID=%s, deviceName=%s", e.status.Uid, e.status.Username, e.status.DeviceID, e.status.DeviceName)

	// get user summaries
	ts := libkb.NewTracker2Syncer(e.G(), e.status.Uid, true)
	if e.G().ConnectivityMonitor.IsConnected(context.Background()) == libkb.ConnectivityMonitorYes {
		e.G().Log.Debug("connected, loading self user upak for cache")
		arg := libkb.NewLoadUserByUIDArg(context.Background(), e.G(), e.status.Uid)
		if _, _, err := e.G().GetUPAKLoader().Load(arg); err != nil {
			e.G().Log.Debug("Bootstrap: error loading upak user for cache priming: %s", err)
		}

		e.G().Log.Debug("connected, running full tracker2 syncer")
		if err := libkb.RunSyncer(ts, e.status.Uid, false, nil); err != nil {
			e.G().Log.Warning("error running Tracker2Syncer: %s", err)
			return nil
		}
	} else {
		e.G().Log.Debug("not connected, running cached tracker2 syncer")
		if err := libkb.RunSyncerCached(ts, e.status.Uid); err != nil {
			e.G().Log.Warning("error running Tracker2Syncer (cached): %s", err)
			return nil
		}
	}
	e.usums = ts.Result()

	// filter usums into followers, following
	for _, u := range e.usums.Users {
		if u.IsFollower {
			e.status.Followers = append(e.status.Followers, u.Username)
		}
		if u.IsFollowee {
			e.status.Following = append(e.status.Following, u.Username)
		}
	}

	return nil
}

// signedUp is true if there's a uid in config.json.
func (e *Bootstrap) signedUp() bool {
	cr := e.G().Env.GetConfig()
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

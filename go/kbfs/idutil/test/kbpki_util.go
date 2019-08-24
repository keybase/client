// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"sync"

	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// DaemonKBPKI is a hacky way to make a KBPKI instance that uses some
// methods from KeybaseService.
type DaemonKBPKI struct {
	idutil.KBPKI
	Daemon *idutil.DaemonLocal
}

// GetCurrentSession implements the idutil.DaemonLocal interface for
// DaemonKBPKI.
func (d *DaemonKBPKI) GetCurrentSession(ctx context.Context) (
	idutil.SessionInfo, error) {
	const sessionID = 0
	return d.Daemon.CurrentSession(ctx, sessionID)
}

// Resolve implements the idutil.DaemonLocal interface for
// DaemonKBPKI.
func (d *DaemonKBPKI) Resolve(
	ctx context.Context, assertion string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return d.Daemon.Resolve(ctx, assertion, offline)
}

// NormalizeSocialAssertion implements the idutil.DaemonLocal
// interface for DaemonKBPKI.
func (d *DaemonKBPKI) NormalizeSocialAssertion(
	ctx context.Context, assertion string) (
	keybase1.SocialAssertion, error) {
	return d.Daemon.NormalizeSocialAssertion(ctx, assertion)
}

// Identify implements the idutil.DaemonLocal interface for
// DaemonKBPKI.
func (d *DaemonKBPKI) Identify(
	ctx context.Context, assertion, reason string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return d.Daemon.Identify(ctx, assertion, reason, offline)
}

// ResolveImplicitTeam implements the idutil.DaemonLocal interface
// for DaemonKBPKI.
func (d *DaemonKBPKI) ResolveImplicitTeam(
	ctx context.Context, assertions, suffix string, tlfType tlf.Type,
	offline keybase1.OfflineAvailability) (
	idutil.ImplicitTeamInfo, error) {
	return d.Daemon.ResolveIdentifyImplicitTeam(
		ctx, assertions, suffix, tlfType, false, "", offline)
}

// GetNormalizedUsername implements the idutil.DaemonLocal interface
// for DaemonKBPKI.
func (d *DaemonKBPKI) GetNormalizedUsername(
	ctx context.Context, id keybase1.UserOrTeamID,
	offline keybase1.OfflineAvailability) (kbname.NormalizedUsername, error) {
	asUser, err := id.AsUser()
	if err != nil {
		return kbname.NormalizedUsername(""), err
	}
	userInfo, err := d.Daemon.LoadUserPlusKeys(
		ctx, asUser, "", keybase1.OfflineAvailability_NONE)
	if err != nil {
		return kbname.NormalizedUsername(""), err
	}
	return userInfo.Name, nil
}

// ResolveTeamTLFID implements the idutil.DaemonLocal interface for
// DaemonKBPKI.
func (d *DaemonKBPKI) ResolveTeamTLFID(
	ctx context.Context, teamID keybase1.TeamID,
	offline keybase1.OfflineAvailability) (tlf.ID, error) {
	settings, err := d.Daemon.GetTeamSettings(ctx, teamID, offline)
	if err != nil {
		return tlf.NullID, err
	}
	tlfID, err := tlf.ParseID(settings.TlfID.String())
	if err != nil {
		return tlf.NullID, err
	}
	return tlfID, nil
}

// IdentifyCountingKBPKI is a KBPKI instance that counts calls to
// Identify.
type IdentifyCountingKBPKI struct {
	idutil.KBPKI
	identifyLock  sync.RWMutex
	identifyCalls int
}

func (ik *IdentifyCountingKBPKI) addIdentifyCall() {
	ik.identifyLock.Lock()
	defer ik.identifyLock.Unlock()
	ik.identifyCalls++
}

// GetIdentifyCalls returns the number of times Identify has been
// called.
func (ik *IdentifyCountingKBPKI) GetIdentifyCalls() int {
	ik.identifyLock.RLock()
	defer ik.identifyLock.RUnlock()
	return ik.identifyCalls
}

// Identify implements the idutil.Identifier interface for
// IdentifyCountingKBPKI.
func (ik *IdentifyCountingKBPKI) Identify(
	ctx context.Context, assertion, reason string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	ik.addIdentifyCall()
	return ik.KBPKI.Identify(ctx, assertion, reason, offline)
}

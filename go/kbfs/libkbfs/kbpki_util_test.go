// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// daemonKBPKI is a hacky way to make a KBPKI instance that uses some
// methods from KeybaseService.
type daemonKBPKI struct {
	KBPKI
	daemon KeybaseService
}

func (d *daemonKBPKI) GetCurrentSession(ctx context.Context) (
	SessionInfo, error) {
	const sessionID = 0
	return d.daemon.CurrentSession(ctx, sessionID)
}

func (d *daemonKBPKI) Resolve(
	ctx context.Context, assertion string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return d.daemon.Resolve(ctx, assertion, offline)
}

func (d *daemonKBPKI) NormalizeSocialAssertion(ctx context.Context, assertion string) (
	keybase1.SocialAssertion, error) {
	return d.daemon.NormalizeSocialAssertion(ctx, assertion)
}

func (d *daemonKBPKI) Identify(
	ctx context.Context, assertion, reason string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return d.daemon.Identify(ctx, assertion, reason, offline)
}

// ResolveImplicitTeam implements the KBPKI interface for KBPKIClient.
func (d *daemonKBPKI) ResolveImplicitTeam(
	ctx context.Context, assertions, suffix string, tlfType tlf.Type) (
	ImplicitTeamInfo, error) {
	return d.daemon.ResolveIdentifyImplicitTeam(
		ctx, assertions, suffix, tlfType, false, "")
}

func (d *daemonKBPKI) GetNormalizedUsername(
	ctx context.Context, id keybase1.UserOrTeamID,
	offline keybase1.OfflineAvailability) (kbname.NormalizedUsername, error) {
	asUser, err := id.AsUser()
	if err != nil {
		return kbname.NormalizedUsername(""), err
	}
	userInfo, err := d.daemon.LoadUserPlusKeys(ctx, asUser, "")
	if err != nil {
		return kbname.NormalizedUsername(""), err
	}
	return userInfo.Name, nil
}

func (d *daemonKBPKI) ResolveTeamTLFID(
	ctx context.Context, teamID keybase1.TeamID,
	offline keybase1.OfflineAvailability) (tlf.ID, error) {
	settings, err := d.daemon.GetTeamSettings(ctx, teamID, offline)
	if err != nil {
		return tlf.NullID, err
	}
	tlfID, err := tlf.ParseID(settings.TlfID.String())
	if err != nil {
		return tlf.NullID, err
	}
	return tlfID, nil
}

// interposeDaemonKBPKI replaces the existing (mock) KBPKI with a
// daemonKBPKI that handles all the username-related calls.
//
// TODO: Make tests that use this just use KBPKIClient; need to figure
// out what to do with other mocked methods of KBPKI.
func interposeDaemonKBPKI(
	config *ConfigMock, users ...kbname.NormalizedUsername) {
	localUsers := MakeLocalUsers(users)
	loggedInUser := localUsers[0]

	daemon := NewKeybaseDaemonMemory(loggedInUser.UID, localUsers, nil,
		kbfscodec.NewMsgpack())
	config.SetKeybaseService(daemon)

	daemonKBPKI := &daemonKBPKI{
		KBPKI:  config.mockKbpki,
		daemon: daemon,
	}
	config.SetKBPKI(daemonKBPKI)
}

// identifyCountingKBPKI is a KBPKI instance that counts calls to
// Identify.
type identifyCountingKBPKI struct {
	KBPKI
	identifyLock  sync.RWMutex
	identifyCalls int
}

func (ik *identifyCountingKBPKI) addIdentifyCall() {
	ik.identifyLock.Lock()
	defer ik.identifyLock.Unlock()
	ik.identifyCalls++
}

func (ik *identifyCountingKBPKI) getIdentifyCalls() int {
	ik.identifyLock.RLock()
	defer ik.identifyLock.RUnlock()
	return ik.identifyCalls
}

func (ik *identifyCountingKBPKI) Identify(
	ctx context.Context, assertion, reason string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	ik.addIdentifyCall()
	return ik.KBPKI.Identify(ctx, assertion, reason, offline)
}

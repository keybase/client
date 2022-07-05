// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/client/go/kbfs/idutil"
	idutiltest "github.com/keybase/client/go/kbfs/idutil/test"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type daemonKBPKI struct {
	KBPKI
	daemon *idutiltest.DaemonKBPKI
}

func (d daemonKBPKI) GetCurrentSession(ctx context.Context) (
	idutil.SessionInfo, error) {
	return d.daemon.GetCurrentSession(ctx)
}

func (d daemonKBPKI) Resolve(
	ctx context.Context, assertion string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return d.daemon.Resolve(ctx, assertion, offline)
}

func (d daemonKBPKI) NormalizeSocialAssertion(
	ctx context.Context, assertion string) (
	keybase1.SocialAssertion, error) {
	return d.daemon.NormalizeSocialAssertion(ctx, assertion)
}

func (d daemonKBPKI) Identify(
	ctx context.Context, assertion, reason string,
	offline keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return d.daemon.Identify(ctx, assertion, reason, offline)
}

func (d daemonKBPKI) ResolveImplicitTeam(
	ctx context.Context, assertions, suffix string, tlfType tlf.Type,
	offline keybase1.OfflineAvailability) (
	idutil.ImplicitTeamInfo, error) {
	return d.daemon.ResolveImplicitTeam(
		ctx, assertions, suffix, tlfType, offline)
}

func (d daemonKBPKI) GetNormalizedUsername(
	ctx context.Context, id keybase1.UserOrTeamID,
	offline keybase1.OfflineAvailability) (kbname.NormalizedUsername, error) {
	return d.daemon.GetNormalizedUsername(ctx, id, offline)
}

func (d daemonKBPKI) ResolveTeamTLFID(
	ctx context.Context, teamID keybase1.TeamID,
	offline keybase1.OfflineAvailability) (tlf.ID, error) {
	return d.daemon.ResolveTeamTLFID(ctx, teamID, offline)
}

// interposeDaemonKBPKI replaces the existing (mock) KBPKI with a
// daemonKBPKI that handles all the username-related calls.
//
// TODO: Make tests that use this just use KBPKIClient; need to figure
// out what to do with other mocked methods of KBPKI.
func interposeDaemonKBPKI(
	config *ConfigMock, users ...kbname.NormalizedUsername) {
	localUsers := idutil.MakeLocalUsers(users)
	loggedInUser := localUsers[0]

	daemon := NewKeybaseDaemonMemory(
		loggedInUser.UID, localUsers, nil, kbfscodec.NewMsgpack())
	config.SetKeybaseService(daemon)

	idutilDaemonKBPKI := &idutiltest.DaemonKBPKI{
		KBPKI:  config.mockKbpki,
		Daemon: daemon.DaemonLocal,
	}
	config.SetKBPKI(daemonKBPKI{config.KBPKI(), idutilDaemonKBPKI})
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
